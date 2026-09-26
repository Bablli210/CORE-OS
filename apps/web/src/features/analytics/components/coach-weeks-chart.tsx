"use client";

import { t } from "@gymos/i18n";
import { useCoachWeeks } from "@gymos/api/analytics/use-analytics";
import { MultiLineChart } from "./multi-line-chart";

/**
 * Sessions completed per coach per gym week, last 12 weeks (mv_coach_week). One line per coach; a coach keeps the same
 * colour slot (alphabetical by name, fixed), whatever the numbers do.
 */
export function CoachWeeksChart({ branch }: { branch: string | null }) {
  const weeks = useCoachWeeks(branch);
  if (weeks.isError) return <p role="alert" className="text-sm text-destructive">{t("error.retryHint")}</p>;
  const rows = weeks.data ?? [];
  const coaches = Array.from(new Map(rows.map((r) => [r.membership_id!, r.full_name ?? ""])).entries()).sort((a, b) => a[1].localeCompare(b[1]));
  const byWeek = new Map<string, Record<string, string | number>>();
  for (const r of rows) {
    const w = String(r.week_start);
    const row = byWeek.get(w) ?? { week_start: w };
    row[r.membership_id!] = Number(r.sessions_completed ?? 0);
    byWeek.set(w, row);
  }
  const data = Array.from(byWeek.values()).sort((a, b) => String(a.week_start).localeCompare(String(b.week_start)));
  return (
    <div data-testid="coach-weeks">
      <MultiLineChart data={data} series={coaches.slice(0, 8).map(([id, name], i) => ({ key: id, name, slot: i + 1 }))} unit="count" title={t("coachTeam.perWeek")} />
    </div>
  );
}
