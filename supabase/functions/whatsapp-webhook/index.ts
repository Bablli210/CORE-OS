// whatsapp-webhook — docs/03 §9. Runs with the service role (bypasses RLS); listed there as an allowed exception.
// Receives delivery status from the WhatsApp provider (Meta Cloud API format; the sandbox provider posts the same):
//   GET  — Meta's subscription check: echoes hub.challenge when hub.verify_token matches WHATSAPP_VERIFY_TOKEN.
//   POST — verifies X-Hub-Signature-256 (HMAC-SHA256 of the raw body with WHATSAPP_APP_SECRET) and moves each
//          message's delivery forward (fn_whatsapp_status: sent → delivered → read, or failed). Repeats are no-ops.
// Always answers 200 to a signed request, even for messages it doesn't know, so the provider doesn't retry forever.

import { parseMetaStatuses, verifySignature } from "../_shared/providers.ts";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const log = (line: Record<string, unknown>) => console.log(JSON.stringify({ fn: "whatsapp-webhook", ...line }));

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const token = env("WHATSAPP_VERIFY_TOKEN");
    if (token && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === token) {
      return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text();
  const secret = env("WHATSAPP_APP_SECRET");
  if (!secret || !(await verifySignature(secret, raw, req.headers.get("x-hub-signature-256")))) {
    log({ rejected: "bad signature" });
    return new Response("forbidden", { status: 403 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  let moved = 0;
  for (const s of parseMetaStatuses(body)) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fn_whatsapp_status`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ p_provider_message_id: s.id, p_status: s.status, p_error: s.error, p_at: s.at }),
    });
    if (!res.ok) {
      log({ message_id: s.id, error: `${res.status} ${await res.text()}` });
      return new Response("retry later", { status: 500 }); // the provider retries; the update is idempotent
    }
    if ((await res.json()) === true) moved += 1;
  }
  return new Response(JSON.stringify({ ok: true, moved }), { status: 200, headers: { "content-type": "application/json" } });
});
