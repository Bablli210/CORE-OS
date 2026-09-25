"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { useWeek } from "@/features/sessions/hooks/use-coach";
import { cairoToday, WEEK_ORDER, weekStart } from "@/features/sessions/week";
import { formatEGP } from "@/lib/format";
import { t, type MessageKey } from "@/lib/i18n";
import type { Team } from "../queries/coaching";

/** One line per coach: this week at a glance (client slots per day) and the link to open their week. */
function WeekStrip({ coach }: { coach: string }) {
  const week = useWeek(coach, weekStart(cairoToday()));
  return (
    <div className="grid grid-cols-7 gap-1 text-center text-xs" aria-label={t("coachTeam.weekStrip")}>
      {WEEK_ORDER.map((d) => {
        const n = week.data?.slots.filter((s) => s.weekday === d && s.kind === "client").length ?? 0;
        return (
          <span key={d} className="grid rounded bg-muted px-1 py-0.5" title={t("coachTeam.slotsOn", { n, day: t(`weekday.${d}` as MessageKey) })}>
            <span className="text-muted-foreground">{t(`weekday.short.${d}` as MessageKey)}</span>
            <span className="font-medium">{week.data ? n : "·"}</span>
          </span>
        );
      })}
    </div>
  );
}

/** Schedules side by side and the coaches' month (docs/04 Team): load vs capacity, sessions, no-shows, net delivered, tier. */
export function CoachesTable({ coaches }: { coaches: Team["coaches"] }) {
  return (
    <ul className="grid gap-2">
      {coaches.map((c) => (
        <li key={c.membership_id} data-testid="team-coach" className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[12rem_1fr_16rem] lg:items-center">
          <span className="grid">
            <span className="font-medium">{c.name}{c.is_head_coach ? ` · ${t("coachTeam.headCoach")}` : ""}</span>
            <span className="text-sm text-muted-foreground">{t("coachTeam.load", { n: c.active_clients, cap: c.capacity })} · {t("coachTeam.weekly", { n: c.weekly_slots })}</span>
          </span>
          <dl className="grid grid-cols-3 gap-2 text-sm md:grid-cols-6">
            <div><dt className="text-xs text-muted-foreground">{t("coachTeam.col.sessions")}</dt><dd>{c.sessions_completed}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("coachTeam.col.noShow")}</dt><dd>{c.no_show_pct}%</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("coachTeam.col.net")}</dt><dd>{formatEGP(c.revenue_delivered_net)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("coachTeam.col.tier")}</dt><dd>{c.commission_pct}%</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("coachTeam.col.unpaid")}</dt><dd>{c.unpaid_sessions}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("coachTeam.col.retention")}</dt><dd>{c.retention_pct === null ? "—" : `${c.retention_pct}%`}</dd></div>
          </dl>
          <div className="grid gap-2">
            <WeekStrip coach={c.membership_id} />
            <Link href={`/coach/schedule?coach=${c.membership_id}`} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label={t("coachTeam.openWeekOf", { name: c.name })}>{t("coachTeam.openWeek")}</Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
