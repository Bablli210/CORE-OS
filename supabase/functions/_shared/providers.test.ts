// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ExpoPush, MetaWhatsApp, parseMetaStatuses, ResendEmail, SandboxWhatsApp, verifySignature, hmacHex, type Outbound } from "./providers.ts";
import { renderDigest, whatsappTemplate, FALLBACK_TEMPLATE } from "./templates.ts";

const msg = (over: Partial<Outbound> = {}): Outbound => ({
  id: "3f1c0000-0000-4000-8000-000000000001",
  type: "session.reminder_24h",
  title: "Session tomorrow",
  body: "Sun 27 Sep 18:00 with Mahmoud",
  data: {},
  recipient: { name: "Hassan Ibrahim", phone: "+201110000001", email: "hassan@example.com", language: "en" },
  ...over,
});
const tpl = whatsappTemplate(msg());
const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("WhatsApp templates", () => {
  it("maps the type to its template and passes first name, title, detail", () => {
    expect(tpl).toEqual({ name: "gymos_session_reminder_24h", language: "en", params: ["Hassan", "Session tomorrow", "Sun 27 Sep 18:00 with Mahmoud"] });
  });
  it("falls back to the generic template and never sends an empty parameter", () => {
    const t = whatsappTemplate(msg({ type: "something.new", body: null, recipient: { ...msg().recipient, name: null, language: "ar" } }));
    expect(t).toEqual({ name: FALLBACK_TEMPLATE, language: "ar", params: ["there", "Session tomorrow", "Session tomorrow"] });
  });
});

describe("SandboxWhatsApp", () => {
  const log = vi.fn();
  it("sends to allowed numbers only, with a message id derived from the notification id", async () => {
    const p = new SandboxWhatsApp({ allow: ["+2011*"], log });
    const r1 = await p.send(msg(), tpl);
    const r2 = await p.send(msg(), tpl);
    expect(r1).toEqual({ outcome: "sent", providerMessageId: `sandbox-${msg().id}`, to: "+201110000001" });
    expect(r2).toEqual(r1); // the same notification is the same message
    expect(await p.send(msg({ recipient: { ...msg().recipient, phone: "+201099999999" } }), tpl)).toMatchObject({ outcome: "failed", error: expect.stringContaining("not a sandbox number") });
    expect(await p.send(msg({ recipient: { ...msg().recipient, phone: null } }), tpl)).toMatchObject({ outcome: "failed" });
  });
  it("reports delivery through a correctly signed webhook once the result is recorded", async () => {
    const fetch = vi.fn((_url: string | URL | Request, _init?: RequestInit) => reply(200, { ok: true }));
    const p = new SandboxWhatsApp({ allow: ["*"], webhookUrl: "http://hook", appSecret: "s3cret", log, fetch: fetch as unknown as typeof globalThis.fetch });
    const r = await p.send(msg(), tpl);
    expect(fetch).not.toHaveBeenCalled();
    await p.afterRecorded(r);
    const [, init] = fetch.mock.calls[0];
    const raw = String(init!.body);
    const sig = (init!.headers as Record<string, string>)["x-hub-signature-256"];
    expect(await verifySignature("s3cret", raw, sig)).toBe(true);
    expect(parseMetaStatuses(JSON.parse(raw))).toEqual([expect.objectContaining({ id: `sandbox-${msg().id}`, status: "delivered", error: null })]);
  });
});

describe("MetaWhatsApp", () => {
  const make = (f: () => Promise<Response>) => new MetaWhatsApp({ token: "t", phoneNumberId: "123", fetch: vi.fn(f) as unknown as typeof globalThis.fetch });
  it("sends a template with the notification id as callback data", async () => {
    const fetch = vi.fn((_u: string | URL | Request, _i?: RequestInit) => reply(200, { messages: [{ id: "wamid.1" }] }));
    const p = new MetaWhatsApp({ token: "t", phoneNumberId: "123", fetch: fetch as unknown as typeof globalThis.fetch });
    expect(await p.send(msg(), tpl)).toEqual({ outcome: "sent", providerMessageId: "wamid.1", to: "201110000001" });
    const body = JSON.parse(String(fetch.mock.calls[0][1]!.body));
    expect(body).toMatchObject({ to: "201110000001", biz_opaque_callback_data: msg().id, template: { name: "gymos_session_reminder_24h", language: { code: "en" } } });
    expect(body.template.components[0].parameters.map((x: { text: string }) => x.text)).toEqual(tpl.params);
  });
  it("retries only refusals (429, throttling); anything ambiguous is final, never resent", async () => {
    expect((await make(() => reply(429, { error: { code: 130429, message: "rate" } })).send(msg(), tpl)).outcome).toBe("retry");
    expect((await make(() => reply(400, { error: { code: 132001, message: "template missing" } })).send(msg(), tpl)).outcome).toBe("failed");
    expect((await make(() => reply(500, {})).send(msg(), tpl)).outcome).toBe("failed");
    expect(await make(() => Promise.reject(new Error("socket hang up"))).send(msg(), tpl)).toMatchObject({ outcome: "failed", error: expect.stringContaining("outcome unknown") });
  });
});

describe("ResendEmail", () => {
  const email = { subject: "s", html: "<p>h</p>", text: "t" };
  it("uses the notification id as the Idempotency-Key", async () => {
    const fetch = vi.fn((_u: string | URL | Request, _i?: RequestInit) => reply(200, { id: "re_1" }));
    const p = new ResendEmail({ apiKey: "k", from: "GymOS <x@y>", fetch: fetch as unknown as typeof globalThis.fetch });
    expect(await p.send(msg(), email)).toEqual({ outcome: "sent", providerMessageId: "re_1", to: "hassan@example.com" });
    expect((fetch.mock.calls[0][1]!.headers as Record<string, string>)["idempotency-key"]).toBe(msg().id);
  });
  it("retries server errors and network errors (the key makes a resend safe), fails bad requests", async () => {
    const make = (f: () => Promise<Response>) => new ResendEmail({ apiKey: "k", from: "x", fetch: vi.fn(f) as unknown as typeof globalThis.fetch });
    expect((await make(() => reply(503, {})).send(msg(), email)).outcome).toBe("retry");
    expect((await make(() => Promise.reject(new Error("down"))).send(msg(), email)).outcome).toBe("retry");
    expect((await make(() => reply(422, { message: "bad from" })).send(msg(), email)).outcome).toBe("failed");
  });
});

describe("webhook signature and parsing", () => {
  it("rejects a tampered body or a missing header", async () => {
    const raw = JSON.stringify({ a: 1 });
    const sig = `sha256=${await hmacHex("k", raw)}`;
    expect(await verifySignature("k", raw, sig)).toBe(true);
    expect(await verifySignature("k", raw.replace("1", "2"), sig)).toBe(false);
    expect(await verifySignature("k", raw, null)).toBe(false);
    expect(await verifySignature("other", raw, sig)).toBe(false);
  });
  it("reads failed statuses with their error and ignores other change types", () => {
    const body = { entry: [{ changes: [{ value: { messages: [{ id: "in" }] } }, { value: { statuses: [{ id: "wamid.2", status: "failed", timestamp: "1790000000", errors: [{ code: 131026, title: "Message undeliverable" }] }] } }] }] };
    expect(parseMetaStatuses(body)).toEqual([{ id: "wamid.2", status: "failed", at: new Date(1790000000 * 1000).toISOString(), error: "131026 Message undeliverable" }]);
  });
});

describe("digests", () => {
  it("renders the sales manager's day with escaped names and EGP from piastres", () => {
    const e = renderDigest({
      kind: "daily", role: "sales_manager", period: "2026-09-26", month: "2026-09", name: "Karim", branch_name: "Branch A",
      today: { visits: 5, sessions_completed: 3, sessions_booked_today: 9, leads: 2, collected: 1234500, unpaid_sessions_open: 1 },
      tiles: [{ key: "sales.won_revenue", value: 5136000, unit: "money", target: 6000000 }],
      reps: [{ name: "Mona <script>", leads: 2, won: 1, won_revenue: 5136000, overdue: 0, open_flags: 1 }],
    }, "https://app");
    expect(e.subject).toContain("Sales");
    expect(e.html).toContain("EGP 12,345");
    expect(e.html).toContain("EGP 51,360 (target EGP 60,000)");
    expect(e.html).toContain("Mona &lt;script&gt;");
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("https://app/sales/team");
    expect(e.text).toContain("Mona <script>: 1 won");
  });
  it("renders the weekly digest week on week per branch", () => {
    const e = renderDigest({
      kind: "weekly", role: "top_management", period: "2026-09-19", month: "2026-09", name: "Omar", branch_name: null,
      branches: { a: "Branch A" },
      weeks: [
        { branch_id: "a", week_start: "2026-09-12", revenue_booked: 100000, revenue_collected: 90000, sessions_completed: 40, new_clients: 2, leads: 5 },
        { branch_id: "a", week_start: "2026-09-19", revenue_booked: 250000, revenue_collected: 200000, sessions_completed: 55, new_clients: 3, leads: 8 },
      ],
      tiles: [],
    }, "https://app");
    expect(e.html).toMatch(/Branch A<\/td><td[^>]*>EGP 1,000<\/td><td[^>]*>EGP 2,500/);
    expect(e.html).toContain("https://app/admin");
  });
});

describe("ExpoPush", () => {
  const withTokens = (tokens: string[]) => msg({ type: "session.completed", title: "7 sessions left", recipient: { ...msg().recipient, push_tokens: tokens } });
  it("sends one message per device with the notification id in data, and revokes dead devices", async () => {
    const fetch = vi.fn((_u: string | URL | Request, _i?: RequestInit) => reply(200, { data: [{ status: "ok", id: "t1" }, { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }] }));
    const dead = vi.fn(async () => true);
    const p = new ExpoPush({ fetch: fetch as unknown as typeof globalThis.fetch, onDeadToken: dead });
    const r = await p.send(withTokens(["ExponentPushToken[a]", "ExponentPushToken[b]"]));
    expect(r).toEqual({ outcome: "sent", providerMessageId: "t1", to: "ExponentPushToken[a]" });
    const body = JSON.parse(String(fetch.mock.calls[0][1]!.body));
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ to: "ExponentPushToken[a]", title: "7 sessions left", data: { notification_id: msg().id, type: "session.completed" } });
    expect(dead).toHaveBeenCalledWith("ExponentPushToken[b]", "DeviceNotRegistered");
  });
  it("fails without a registered device, retries only 429, never resends after a network error", async () => {
    const make = (f: () => Promise<Response>) => new ExpoPush({ fetch: vi.fn(f) as unknown as typeof globalThis.fetch });
    expect((await make(() => reply(200, {})).send(withTokens([]))).outcome).toBe("failed");
    expect((await make(() => reply(429, { errors: [{ message: "slow down" }] })).send(withTokens(["ExponentPushToken[a]"]))).outcome).toBe("retry");
    expect((await make(() => reply(500, {})).send(withTokens(["ExponentPushToken[a]"]))).outcome).toBe("failed");
    expect(await make(() => Promise.reject(new Error("down"))).send(withTokens(["ExponentPushToken[a]"]))).toMatchObject({ outcome: "failed", error: expect.stringContaining("outcome unknown") });
  });
});
