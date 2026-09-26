"use client";

import Link from "next/link";
import { cairoToday } from "@gymos/api/sessions/week";
import { formatEGP } from "@gymos/api/format";
import { t, type MessageKey } from "@gymos/i18n";
import { useTodayLive } from "@gymos/api/analytics/use-today-live";
import type { TodayLive } from "@gymos/api/analytics/analytics";

const ITEMS: { key: keyof TodayLive; label: MessageKey; money?: boolean; href?: string; table?: string }[] = [
  { key: "visits", label: "live.visits", table: "visit" },
  { key: "sessions_completed", label: "live.sessions", table: "session" },
  { key: "leads", label: "live.leads", table: "lead" },
  { key: "collected", label: "live.collected", money: true, href: "/admin/money" },
  { key: "unpaid_sessions_open", label: "live.unpaid", href: "/admin/money" },
];

/** /admin live strip: today across both branches (fn_today_live), every 30s and on every event (Realtime). */
export function TodayStrip() {
  const today = useTodayLive();
  const d = today.data;
  const day = cairoToday();
  const hrefOf = (i: (typeof ITEMS)[number]) => i.href ?? (i.table ? `/admin/audit?source=events&table=${i.table}&from=${day}&to=${day}` : undefined);
  return (
    <section aria-labelledby="today-h" className="grid gap-2 rounded-lg border bg-card p-3" data-testid="today-strip">
      <h2 id="today-h" className="flex items-center gap-2 text-sm font-medium">
        <span className="size-2 rounded-full bg-success motion-safe:animate-pulse" aria-hidden />
        {t("live.title")}
        {today.isError ? <span role="alert" className="text-xs font-normal text-destructive">{t("live.stale")}</span> : null}
      </h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-live="polite">
        {ITEMS.map((i) => {
          const value = d ? (i.money ? formatEGP(Number(d[i.key] ?? 0)) : String(d[i.key] ?? 0)) : "…";
          const extra = i.key === "sessions_completed" && d ? t("live.ofBooked", { n: d.sessions_booked_today }) : null;
          const body = (
            <>
              <span className="block text-xs text-muted-foreground">{t(i.label)}</span>
              <span className="block text-lg font-semibold tabular-nums" data-testid={`today-${i.key}`} data-value={d ? Number(d[i.key] ?? 0) : ""}>
                {value}{extra ? <span className="ms-1 text-xs font-normal text-muted-foreground">{extra}</span> : null}
              </span>
            </>
          );
          return (
            <li key={i.key}>
              {hrefOf(i) ? (
                <Link href={hrefOf(i)!} className="block h-full rounded-md bg-muted p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</Link>
              ) : <div className="h-full rounded-md bg-muted p-2">{body}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
