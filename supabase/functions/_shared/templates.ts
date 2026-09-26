// What each notification looks like on the wire. WhatsApp business-initiated messages must use templates approved in
// Meta Business Manager; every GymOS template takes the same three body parameters — {{1}} first name, {{2}} title,
// {{3}} detail — so the database's title/body are the message and the template adds the greeting and sign-off.
// Emails (staff digests) are rendered here from fn_digest's numbers. Plain inline styles: email clients ignore CSS files.

import type { Outbound, RenderedEmail, WhatsAppTemplate } from "./providers.ts";

export const WHATSAPP_TEMPLATES: Record<string, string> = {
  "session.reminder_24h": "gymos_session_reminder_24h",
  "session.reminder_2h": "gymos_session_reminder_2h",
  "session.added": "gymos_session_added",
  "credits.low": "gymos_credits_low",
  "credits.expiring_14d": "gymos_credits_expiring",
  "payment.recorded": "gymos_payment_recorded",
  "client.created": "gymos_welcome",
  "coach.assigned": "gymos_coach_assigned",
  "freeze.started": "gymos_freeze_started",
  "freeze.ended": "gymos_freeze_ended",
};
export const FALLBACK_TEMPLATE = "gymos_update";

export function whatsappTemplate(msg: Outbound): WhatsAppTemplate {
  const first = (msg.recipient.name ?? "").trim().split(/\s+/)[0] || "there";
  return {
    name: WHATSAPP_TEMPLATES[msg.type] ?? FALLBACK_TEMPLATE,
    language: msg.recipient.language === "ar" ? "ar" : "en",
    params: [first, msg.title, msg.body?.trim() || msg.title],
  };
}

// ------------------------------------------------------------------ email
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const egp = (piastres: unknown) => `EGP ${Math.round(Number(piastres ?? 0) / 100).toLocaleString("en-US")}`;
const num = (n: unknown) => Number(n ?? 0).toLocaleString("en-US");

type Tile = { key: string; value: number | null; unit: string; target?: number | null };
export type Digest = {
  kind: "daily" | "weekly";
  role: string;
  period: string;
  month: string;
  name: string | null;
  branch_name: string | null;
  today?: Record<string, number>;
  tiles?: Tile[];
  reps?: { name: string; leads: number; won: number; won_revenue: number; overdue: number; open_flags: number }[];
  coaches?: { name: string; sessions: number; no_show_pct: number; unpaid: number; commission_pct: number }[];
  weeks?: { branch_id: string; week_start: string; revenue_booked: number; revenue_collected: number; sessions_completed: number; new_clients: number; leads: number }[];
  branches?: Record<string, string>;
};

const TILE_LABELS: Record<string, string> = {
  "sales.won_revenue": "Won revenue", "sales.leads": "New leads", "sales.conversion": "Conversion", "sales.response": "Median response",
  "sales.membership_collected": "Membership collected", "sales.commission": "Membership commission", "sales.overdue": "Overdue follow-ups", "sales.open_flags": "Open flags",
  "admin.booked": "Booked", "admin.collected_on_booked": "Collected on booked", "admin.outstanding": "Outstanding", "admin.collected": "Collected",
  "admin.delivered": "Delivered", "admin.delivered_net": "Delivered (net)", "admin.deferred": "Deferred (liability)", "admin.coach_commission": "Coach commission",
  "admin.rep_commission": "Sales commission", "admin.new_clients": "New clients", "admin.lapsed": "Lapsed clients", "admin.net_clients": "Net clients",
  "admin.sessions": "Sessions completed", "admin.no_show_pct": "No-show rate", "admin.unpaid": "Unpaid sessions",
};

function tileValue(t: Tile): string {
  if (t.value === null || t.value === undefined) return "—";
  if (t.unit === "money") return egp(t.value);
  if (t.unit === "pct") return `${t.value}%`;
  if (t.unit === "minutes") return `${Math.round(Number(t.value))} min`;
  return num(t.value);
}

function table(headers: string[], rows: (string | number)[][]): string {
  const th = headers.map((h, i) => `<th style="text-align:${i ? "right" : "left"};padding:6px 8px;border-bottom:1px solid #ddd;font-weight:600">${esc(h)}</th>`).join("");
  const tr = rows.map((r) => `<tr>${r.map((c, i) => `<td style="text-align:${i ? "right" : "left"};padding:6px 8px;border-bottom:1px solid #eee">${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<table style="border-collapse:collapse;width:100%;font-size:14px"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

function page(title: string, intro: string, sections: string[], appUrl: string, link: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f6;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111">
<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:24px">
<h1 style="font-size:20px;margin:0 0 4px">${esc(title)}</h1><p style="margin:0 0 16px;color:#555">${esc(intro)}</p>
${sections.map((s) => `<div style="margin:0 0 20px">${s}</div>`).join("")}
<p style="margin:16px 0 0"><a href="${esc(appUrl + link)}" style="color:#111">Open GymOS</a></p>
<p style="margin:16px 0 0;font-size:12px;color:#777">You get this because you are on the digest list in GymOS settings.</p>
</div></body></html>`;
}

const h2 = (s: string) => `<h2 style="font-size:15px;margin:0 0 8px">${esc(s)}</h2>`;

export function renderDigest(d: Digest, appUrl: string): RenderedEmail {
  const today = d.today
    ? h2("Today so far") + table(["", ""], [["Visits", num(d.today.visits)], ["Sessions done", `${num(d.today.sessions_completed)} of ${num(d.today.sessions_booked_today)}`],
        ["New leads", num(d.today.leads)], ["Collected", egp(d.today.collected)], ["Unpaid sessions open", num(d.today.unpaid_sessions_open)]])
    : "";
  const tiles = d.tiles?.length ? h2(`${d.month} so far`) + table(["", ""], d.tiles.map((t) => [TILE_LABELS[t.key] ?? t.key, tileValue(t) + (t.target ? ` (target ${t.unit === "money" ? egp(t.target) : num(t.target)})` : "")])) : "";
  if (d.kind === "weekly") {
    const byBranch = (field: "revenue_booked" | "revenue_collected" | "sessions_completed" | "new_clients") =>
      Object.entries(d.branches ?? {}).map(([id, name]) => {
        const w = (d.weeks ?? []).filter((x) => x.branch_id === id).sort((a, b) => a.week_start.localeCompare(b.week_start));
        const last = w[w.length - 1]?.[field] ?? 0;
        const prev = w[w.length - 2]?.[field] ?? 0;
        const fmt = field.startsWith("revenue") ? egp : num;
        return [name, fmt(prev), fmt(last)];
      });
    const weeks = h2("Week on week") + ["revenue_booked", "revenue_collected", "sessions_completed", "new_clients"].map((f) =>
      `<p style="margin:8px 0 4px;color:#555">${esc({ revenue_booked: "Revenue booked", revenue_collected: "Collected", sessions_completed: "Sessions completed", new_clients: "New clients" }[f])}</p>` +
      table(["Branch", "Week before", "Last week"], byBranch(f as "revenue_booked"))).join("");
    const subject = `GymOS weekly digest · week of ${d.period}`;
    const html = page("Weekly digest", `Both branches, week of ${d.period}.`, [weeks, tiles], appUrl, "/admin");
    return { subject, html, text: textOf(subject, d) };
  }
  const people = d.reps
    ? h2("Reps this month") + table(["Rep", "Leads", "Won", "Won revenue", "Overdue", "Flags"], d.reps.map((r) => [r.name, num(r.leads), num(r.won), egp(r.won_revenue), num(r.overdue), num(r.open_flags)]))
    : d.coaches
      ? h2("Coaches this month") + table(["Coach", "Sessions", "No-show", "Unpaid", "Tier"], d.coaches.map((c) => [c.name, num(c.sessions), `${c.no_show_pct ?? 0}%`, num(c.unpaid), `${c.commission_pct ?? 0}%`]))
      : "";
  const who = d.role === "sales_manager" ? "Sales" : "Coaching";
  const subject = `GymOS daily digest · ${who} · ${d.branch_name ?? ""} · ${d.period}`;
  const html = page(`Daily digest · ${who}`, `${d.branch_name ?? ""}, ${d.period}.`, [today, tiles, people], appUrl, d.role === "sales_manager" ? "/sales/team" : "/coach/team");
  return { subject, html, text: textOf(subject, d) };
}

function textOf(subject: string, d: Digest): string {
  const lines = [subject, ""];
  if (d.today) lines.push(`Visits ${d.today.visits}, sessions ${d.today.sessions_completed}/${d.today.sessions_booked_today}, leads ${d.today.leads}, collected ${egp(d.today.collected)}, unpaid open ${d.today.unpaid_sessions_open}`);
  for (const t of d.tiles ?? []) lines.push(`${TILE_LABELS[t.key] ?? t.key}: ${tileValue(t)}`);
  for (const r of d.reps ?? []) lines.push(`${r.name}: ${r.won} won, ${egp(r.won_revenue)}, ${r.overdue} overdue, ${r.open_flags} flags`);
  for (const c of d.coaches ?? []) lines.push(`${c.name}: ${c.sessions} sessions, no-show ${c.no_show_pct ?? 0}%, unpaid ${c.unpaid}`);
  return lines.join("\n");
}

/** A staff notification sent by email (anything that isn't a digest): the title and body, and a link to the app. */
export function renderGeneric(msg: Outbound, appUrl: string): RenderedEmail {
  const html = page(msg.title, msg.body ?? "", [], appUrl, "/notifications");
  return { subject: msg.title, html, text: [msg.title, msg.body ?? "", `${appUrl}/notifications`].join("\n\n") };
}
