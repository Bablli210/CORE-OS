// notify — docs/03 §9. Runs with the service role (bypasses RLS); listed there as an allowed exception.
// Invoked every 5 minutes by pg_cron (fn_invoke_notify → pg_net) with the shared secret from Vault; not callable
// without it. Each run:
//   1. claims pending WhatsApp / email / push notifications (fn_notify_claim: a lease per notification id, so two runs
//      never send the same one, and a lost result is resent only through a provider that dedupes on the id),
//   2. renders them (WhatsApp template, digest or generic email) and sends them through the configured provider,
//   3. records the outcome (fn_notify_result: sent, retry with backoff, or failed with the provider's error).
// Providers come from the environment: WHATSAPP_PROVIDER sandbox|meta, EMAIL_PROVIDER log|mailpit|resend,
// PUSH_PROVIDER expo|log|none (expo: the phone app's registered devices; none leaves push rows pending).

import { ExpoPush, LogEmail, LogPush, MailpitEmail, MetaWhatsApp, ResendEmail, SandboxWhatsApp, type Channel, type EmailProvider, type Outbound, type PushProvider, type SendResult, type WhatsAppProvider } from "../_shared/providers.ts";
import { renderDigest, renderGeneric, whatsappTemplate, type Digest } from "../_shared/templates.ts";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const APP_URL = env("APP_URL", "http://localhost:3000");
const log = (line: Record<string, unknown>) => console.log(JSON.stringify({ fn: "notify", ...line }));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${fn} → ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

function whatsapp(): WhatsAppProvider {
  if (env("WHATSAPP_PROVIDER", "sandbox") === "meta") {
    return new MetaWhatsApp({ token: env("META_WA_TOKEN"), phoneNumberId: env("META_WA_PHONE_NUMBER_ID"), apiVersion: env("META_WA_API_VERSION", "v20.0") });
  }
  return new SandboxWhatsApp({
    allow: env("WHATSAPP_SANDBOX_NUMBERS", "*").split(",").map((s) => s.trim()).filter(Boolean),
    webhookUrl: env("WHATSAPP_WEBHOOK_URL") || undefined,
    appSecret: env("WHATSAPP_APP_SECRET") || undefined,
    log,
  });
}

function email(): EmailProvider {
  const from = env("EMAIL_FROM", "GymOS <digest@gymos.local>");
  switch (env("EMAIL_PROVIDER", "log")) {
    case "resend": return new ResendEmail({ apiKey: env("RESEND_API_KEY"), from });
    case "mailpit": return new MailpitEmail({ url: env("MAILPIT_URL", "http://supabase_inbucket_gymos:8025"), from: from.replace(/^.*<|>$/g, "") });
    default: return new LogEmail(log);
  }
}

function push(): PushProvider | null {
  switch (env("PUSH_PROVIDER", "none")) {
    case "expo":
      return new ExpoPush({ accessToken: env("EXPO_ACCESS_TOKEN") || undefined, onDeadToken: (token, reason) => rpc("fn_revoke_push_token", { p_token: token, p_reason: reason }) });
    case "log":
      return new LogPush(log);
    default:
      return null;
  }
}

/** Constant-time comparison of the shared secret. */
function sameSecret(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

type Claimed = Outbound & { channel: Channel; attempt: number };

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!sameSecret(req.headers.get("x-notify-secret") ?? "", env("NOTIFY_SECRET"))) return json({ ok: false, error: "forbidden" }, 403);

  const providers = { whatsapp: whatsapp(), email: email(), push: push() };
  const channels = (Object.keys(providers) as Channel[]).filter((c) => providers[c]);
  const reclaim = channels.filter((c) => providers[c]!.idempotent);
  const batch = Number(env("NOTIFY_BATCH", "50"));

  let claimed: Claimed[];
  try {
    claimed = await rpc<Claimed[]>("fn_notify_claim", { p_limit: batch, p_lease_seconds: 300, p_reclaim: reclaim, p_channels: channels });
  } catch (e) {
    log({ error: String(e) });
    return json({ ok: false, error: "claim_failed" }, 500);
  }

  const counts = { claimed: claimed.length, sent: 0, retry: 0, failed: 0 };
  for (const msg of claimed) {
    const provider = providers[msg.channel]!;
    let result: SendResult;
    try {
      if (msg.channel === "whatsapp") {
        result = await (provider as WhatsAppProvider).send(msg, whatsappTemplate(msg));
      } else if (msg.channel === "email") {
        const rendered = msg.type.startsWith("digest.") ? renderDigest(await rpc<Digest>("fn_digest", { p_notification_id: msg.id }), APP_URL) : renderGeneric(msg, APP_URL);
        result = await (provider as EmailProvider).send(msg, rendered);
      } else {
        result = await (provider as PushProvider).send(msg);
      }
    } catch (e) {
      // failed before anything was handed to the provider (rendering, digest numbers): safe to try again
      result = { outcome: "retry", error: `before send: ${String(e)}` };
    }
    counts[result.outcome] += 1;
    try {
      await rpc("fn_notify_result", {
        p_id: msg.id,
        p_outcome: result.outcome,
        p_provider: provider.name,
        p_provider_message_id: result.outcome === "sent" ? result.providerMessageId : null,
        p_error: result.outcome === "sent" ? null : result.error,
        p_to: result.to ?? null,
      });
      if (msg.channel === "whatsapp") await (provider as WhatsAppProvider).afterRecorded?.(result);
    } catch (e) {
      // the lease expires; fn_notify_claim then resends only through an idempotent provider, else closes it
      log({ notification_id: msg.id, error: `result not recorded: ${String(e)}` });
    }
  }
  log({ run: counts });
  return json({ ok: true, ...counts });
});
