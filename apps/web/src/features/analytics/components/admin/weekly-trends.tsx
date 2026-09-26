"use client";

import { useMe } from "@/features/auth/me-context";
import { t, type MessageKey } from "@gymos/i18n";
import { useWeekly } from "@gymos/api/analytics/use-analytics";
import type { Unit, Weekly } from "@gymos/api/analytics/analytics";
import { MultiLineChart } from "../multi-line-chart";

const CHARTS: { key: keyof Weekly; title: MessageKey; unit: Unit }[] = [
  { key: "revenue_booked", title: "trend.booked", unit: "money" },
  { key: "revenue_collected", title: "trend.collected", unit: "money" },
  { key: "sessions_completed", title: "trend.sessions", unit: "count" },
  { key: "new_clients", title: "trend.newClients", unit: "count" },
];

/** 12 gym weeks per branch (fn_dashboard_weekly over mv_daily_branch). A branch keeps its colour slot on every chart. */
export function WeeklyTrends() {
  const { branches } = useMe();
  const weekly = useWeekly();
  if (weekly.isError) return <p role="alert" className="text-sm text-destructive">{t("error.retryHint")}</p>;
  const rows = weekly.data ?? [];
  const series = branches.slice(0, 8).map((b, i) => ({ key: b.id, name: b.name, slot: i + 1 }));
  const shape = (key: keyof Weekly) => {
    const byWeek = new Map<string, Record<string, string | number>>();
    for (const r of rows) {
      const w = String(r.week_start);
      const row = byWeek.get(w) ?? { week_start: w };
      row[r.branch_id!] = Number(r[key] ?? 0);
      byWeek.set(w, row);
    }
    return Array.from(byWeek.values()).sort((a, b) => String(a.week_start).localeCompare(String(b.week_start)));
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="weekly-trends">
      {CHARTS.map((c) => (
        <div key={c.key} className="grid gap-1">
          <h3 className="text-sm font-medium">{t(c.title)}</h3>
          <MultiLineChart data={shape(c.key)} series={series} unit={c.unit} title={t(c.title)} />
        </div>
      ))}
    </div>
  );
}
