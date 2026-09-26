// Delivery providers behind one interface per channel (docs/03 §9: notify). Pure TypeScript with fetch and WebCrypto
// only — no Deno globals — so the same code runs in the Edge runtime and in Vitest. Configuration is passed in; the
// function's index.ts reads it from the environment.
//
// Idempotency by notification id: every send carries the notification id. A provider that dedupes on it
// (`idempotent: true`) may be sent the same notification again after a lost result; one that doesn't is never
// resent once a send may have happened (fn_notify_claim closes it instead).

export type Channel = "whatsapp" | "email" | "push";

export type Outbound = {
  id: string; // notification id = idempotency key
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  recipient: { name: string | null; phone: string | null; email: string | null; language: string; push_tokens?: string[] | null };
};

export type SendResult =
  | { outcome: "sent"; providerMessageId: string; to: string }
  | { outcome: "retry"; error: string; to?: string } // the provider said it did not send; safe to try again
  | { outcome: "failed"; error: string; to?: string }; // will not be sent

export interface WhatsAppProvider {
  readonly name: string;
  readonly idempotent: boolean;
  send(msg: Outbound, template: WhatsAppTemplate): Promise<SendResult>;
  /** Called once the send's result is recorded (the sandbox reports delivery here, as a real provider would later). */
  afterRecorded?(result: SendResult): Promise<void>;
}
export interface EmailProvider {
  readonly name: string;
  readonly idempotent: boolean;
  send(msg: Outbound, email: RenderedEmail): Promise<SendResult>;
}
export interface PushProvider {
  readonly name: string;
  readonly idempotent: boolean;
  send(msg: Outbound): Promise<SendResult>;
}

export type WhatsAppTemplate = { name: string; language: string; params: string[] };
export type RenderedEmail = { subject: string; html: string; text: string };
export type Log = (line: Record<string, unknown>) => void;

type Fetch = typeof fetch;

// ------------------------------------------------------------------ WhatsApp
/**
 * Local and staging sandbox: nothing leaves the building. Logs the message, "delivers" only to allowed numbers
 * (`*` = any; a trailing `*` is a prefix), and — like a real provider — reports delivery back through the signed
 * whatsapp-webhook once the send is recorded, so the whole status path runs locally. The message id is derived from the notification id, so a
 * second send of the same notification is the same message.
 */
export class SandboxWhatsApp implements WhatsAppProvider {
  readonly name = "sandbox";
  readonly idempotent = true;
  constructor(
    private opts: { allow: string[]; webhookUrl?: string; appSecret?: string; log: Log; fetch?: Fetch },
  ) {}

  allowed(phone: string): boolean {
    return this.opts.allow.some((a) => a === "*" || (a.endsWith("*") ? phone.startsWith(a.slice(0, -1)) : phone === a));
  }

  async send(msg: Outbound, template: WhatsAppTemplate): Promise<SendResult> {
    const to = msg.recipient.phone;
    if (!to) return { outcome: "failed", error: "no phone number" };
    if (!this.allowed(to)) return { outcome: "failed", error: `not a sandbox number: ${to}`, to };
    const id = `sandbox-${msg.id}`;
    this.opts.log({ provider: this.name, to, template: template.name, params: template.params, notification_id: msg.id, message_id: id });
    return { outcome: "sent", providerMessageId: id, to };
  }

  async afterRecorded(result: SendResult): Promise<void> {
    if (result.outcome !== "sent" || !this.opts.webhookUrl || !this.opts.appSecret) return;
    const raw = JSON.stringify(metaStatusPayload([{ id: result.providerMessageId, status: "delivered", recipient_id: result.to.replace(/^\+/, "") }]));
    const sig = await hmacHex(this.opts.appSecret, raw);
    try {
      await (this.opts.fetch ?? fetch)(this.opts.webhookUrl, { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": `sha256=${sig}` }, body: raw });
    } catch (e) {
      this.opts.log({ provider: this.name, warning: "delivery report failed", error: String(e) });
    }
  }
}

/**
 * WhatsApp Cloud API (Meta) template messages. The API has no idempotency key, so this provider is not idempotent:
 * the notification id travels as `biz_opaque_callback_data` for correlation, and an ambiguous failure (network error,
 * 5xx) is reported as failed, never retried. Rate limits (429) and throttling codes are safe to retry.
 */
export class MetaWhatsApp implements WhatsAppProvider {
  readonly name = "meta";
  readonly idempotent = false;
  constructor(private opts: { token: string; phoneNumberId: string; apiVersion?: string; fetch?: Fetch }) {}

  async send(msg: Outbound, template: WhatsAppTemplate): Promise<SendResult> {
    const to = msg.recipient.phone?.replace(/^\+/, "");
    if (!to) return { outcome: "failed", error: "no phone number" };
    const url = `https://graph.facebook.com/${this.opts.apiVersion ?? "v20.0"}/${this.opts.phoneNumberId}/messages`;
    const body = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      biz_opaque_callback_data: msg.id,
      template: {
        name: template.name,
        language: { code: template.language },
        components: template.params.length ? [{ type: "body", parameters: template.params.map((text) => ({ type: "text", text })) }] : [],
      },
    };
    let res: Response;
    try {
      res = await (this.opts.fetch ?? fetch)(url, { method: "POST", headers: { authorization: `Bearer ${this.opts.token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) {
      return { outcome: "failed", error: `network error, outcome unknown: ${String(e)}`, to };
    }
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { code?: number; message?: string } };
    if (res.ok && json.messages?.[0]?.id) return { outcome: "sent", providerMessageId: json.messages[0].id, to };
    const error = `meta ${res.status}: ${json.error?.message ?? "no message id"}`;
    // 429 and Meta's throttling codes are refusals before sending: safe to retry. Everything else is final.
    if (res.status === 429 || [4, 80007, 130429, 131048, 131056].includes(Number(json.error?.code))) return { outcome: "retry", error, to };
    return { outcome: "failed", error, to };
  }
}

// ------------------------------------------------------------------ email
export class LogEmail implements EmailProvider {
  readonly name = "log";
  readonly idempotent = true;
  constructor(private log: Log) {}
  async send(msg: Outbound, email: RenderedEmail): Promise<SendResult> {
    const to = msg.recipient.email;
    if (!to) return { outcome: "failed", error: "no email address" };
    this.log({ provider: this.name, to, subject: email.subject, notification_id: msg.id });
    return { outcome: "sent", providerMessageId: `log-${msg.id}`, to };
  }
}

/** Local inbox (Mailpit's send API), so digests can be opened at http://localhost:54324. */
export class MailpitEmail implements EmailProvider {
  readonly name = "mailpit";
  readonly idempotent = false;
  constructor(private opts: { url: string; from: string; fetch?: Fetch }) {}
  async send(msg: Outbound, email: RenderedEmail): Promise<SendResult> {
    const to = msg.recipient.email;
    if (!to) return { outcome: "failed", error: "no email address" };
    try {
      const res = await (this.opts.fetch ?? fetch)(`${this.opts.url}/api/v1/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          From: { Email: this.opts.from, Name: "GymOS" },
          To: [{ Email: to, Name: msg.recipient.name ?? "" }],
          Subject: email.subject,
          HTML: email.html,
          Text: email.text,
          Headers: { "X-Notification-Id": msg.id },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ID?: string };
      return res.ok && json.ID ? { outcome: "sent", providerMessageId: `mailpit-${json.ID}`, to } : { outcome: "failed", error: `mailpit ${res.status}`, to };
    } catch (e) {
      return { outcome: "failed", error: `mailpit unreachable: ${String(e)}`, to };
    }
  }
}

/** Resend, with the notification id as its Idempotency-Key: a resend of the same notification is the same email. */
export class ResendEmail implements EmailProvider {
  readonly name = "resend";
  readonly idempotent = true;
  constructor(private opts: { apiKey: string; from: string; fetch?: Fetch }) {}
  async send(msg: Outbound, email: RenderedEmail): Promise<SendResult> {
    const to = msg.recipient.email;
    if (!to) return { outcome: "failed", error: "no email address" };
    let res: Response;
    try {
      res = await (this.opts.fetch ?? fetch)("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${this.opts.apiKey}`, "content-type": "application/json", "idempotency-key": msg.id },
        body: JSON.stringify({ from: this.opts.from, to: [to], subject: email.subject, html: email.html, text: email.text }),
      });
    } catch (e) {
      return { outcome: "retry", error: `network error: ${String(e)}`, to }; // idempotent: safe to try again
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (res.ok && json.id) return { outcome: "sent", providerMessageId: json.id, to };
    const error = `resend ${res.status}: ${json.message ?? ""}`;
    return res.status === 429 || res.status >= 500 ? { outcome: "retry", error, to } : { outcome: "failed", error, to };
  }
}

// ------------------------------------------------------------------ push
/** Local push: logs the message (PUSH_PROVIDER=log). The phone app's pushes go through ExpoPush. */
export class LogPush implements PushProvider {
  readonly name = "log";
  readonly idempotent = true;
  constructor(private log: Log) {}
  async send(msg: Outbound): Promise<SendResult> {
    const to = msg.recipient.phone ?? msg.recipient.email ?? "device";
    this.log({ provider: "push-log", to, title: msg.title, notification_id: msg.id });
    return { outcome: "sent", providerMessageId: `push-log-${msg.id}`, to };
  }
}

/**
 * Expo Push (M8): one message per active device of the recipient (`push_tokens`, from 0013's claim). Expo's API has
 * no idempotency key, so this is not idempotent: a network error or a 5xx is final, never resent; only 429 is retried.
 * Tickets that say DeviceNotRegistered revoke that token. Sent when at least one device accepted it.
 */
export class ExpoPush implements PushProvider {
  readonly name = "expo";
  readonly idempotent = false;
  constructor(private opts: { accessToken?: string; onDeadToken?: (token: string, reason: string) => Promise<unknown>; fetch?: Fetch }) {}

  async send(msg: Outbound): Promise<SendResult> {
    const tokens = msg.recipient.push_tokens ?? [];
    if (!tokens.length) return { outcome: "failed", error: "no phone registered for push (the person hasn't signed in on the app)" };
    const messages = tokens.map((to) => ({ to, title: msg.title, body: msg.body ?? undefined, sound: "default", data: { ...msg.data, notification_id: msg.id, type: msg.type } }));
    let res: Response;
    try {
      res = await (this.opts.fetch ?? fetch)("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", ...(this.opts.accessToken ? { authorization: `Bearer ${this.opts.accessToken}` } : {}) },
        body: JSON.stringify(messages),
      });
    } catch (e) {
      return { outcome: "failed", error: `network error, outcome unknown: ${String(e)}`, to: tokens.join(",") };
    }
    const json = (await res.json().catch(() => ({}))) as { data?: { status: "ok" | "error"; id?: string; message?: string; details?: { error?: string } }[]; errors?: { message: string }[] };
    if (!res.ok) {
      const error = `expo ${res.status}: ${json.errors?.[0]?.message ?? ""}`;
      return res.status === 429 ? { outcome: "retry", error, to: tokens.join(",") } : { outcome: "failed", error, to: tokens.join(",") };
    }
    const tickets = json.data ?? [];
    await Promise.all(tickets.map((t, i) => (t.status === "error" && t.details?.error === "DeviceNotRegistered" && this.opts.onDeadToken ? this.opts.onDeadToken(tokens[i], "DeviceNotRegistered").catch(() => undefined) : null)));
    const ok = tickets.filter((t) => t.status === "ok" && t.id).map((t) => t.id as string);
    if (ok.length) return { outcome: "sent", providerMessageId: ok.join(","), to: tokens.filter((_, i) => tickets[i]?.status === "ok").join(",") };
    return { outcome: "failed", error: `expo: ${tickets[0]?.details?.error ?? tickets[0]?.message ?? "no ticket"}`, to: tokens.join(",") };
  }
}

// ------------------------------------------------------------------ webhook helpers
type MetaStatus = { id: string; status: string; recipient_id?: string; timestamp?: string; errors?: { code?: number; title?: string; message?: string }[] };

export function metaStatusPayload(statuses: MetaStatus[]) {
  const ts = String(Math.floor(Date.now() / 1000));
  return { object: "whatsapp_business_account", entry: [{ id: "sandbox", changes: [{ field: "messages", value: { messaging_product: "whatsapp", statuses: statuses.map((s) => ({ timestamp: ts, ...s })) } }] }] };
}

/** The status updates in a WhatsApp Cloud API webhook body (other change types are ignored). */
export function parseMetaStatuses(body: unknown): { id: string; status: string; at: string; error: string | null }[] {
  const out: { id: string; status: string; at: string; error: string | null }[] = [];
  const entries = (body as { entry?: { changes?: { value?: { statuses?: MetaStatus[] } }[] }[] })?.entry ?? [];
  for (const e of entries)
    for (const c of e.changes ?? [])
      for (const s of c.value?.statuses ?? []) {
        if (!s?.id || !s.status) continue;
        const err = s.errors?.[0];
        out.push({ id: s.id, status: s.status, at: new Date(Number(s.timestamp ?? Date.now() / 1000) * 1000).toISOString(), error: err ? `${err.code ?? ""} ${err.title ?? err.message ?? ""}`.trim() : null });
      }
  return out;
}

export async function hmacHex(secret: string, raw: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time check of Meta's `X-Hub-Signature-256: sha256=<hex>` header over the raw body. */
export async function verifySignature(secret: string, raw: string, header: string | null): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const expected = await hmacHex(secret, raw);
  const got = header.slice(7);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
