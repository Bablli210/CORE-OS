import { t, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { WEEK_ORDER } from "@/features/sessions/week";
import type { HeatmapRow } from "../queries/coaching";

// Sequential scale: one hue (the chart ink), light → dark in five steps; the numbers are in each cell's label and tooltip.
const STEPS = ["bg-chart-1/5", "bg-chart-1/20", "bg-chart-1/40", "bg-chart-1/65", "bg-chart-1/90"];

/** Weekday × hour, sessions + visits over the last 8 weeks (mv_heatmap via fn_dashboard_heatmap). A table, so it reads as data too. */
export function Heatmap({ rows }: { rows: HeatmapRow[] }) {
  const hours = Array.from(new Set(rows.map((r) => r.hr!))).sort((a, b) => a - b);
  const value = (dow: number, hr: number) => {
    const r = rows.find((x) => x.dow === dow && x.hr === hr);
    return { sessions: r?.sessions ?? 0, visits: r?.visits ?? 0 };
  };
  const max = Math.max(1, ...rows.map((r) => (r.sessions ?? 0) + (r.visits ?? 0)));
  const step = (n: number) => (n === 0 ? "bg-transparent" : STEPS[Math.min(STEPS.length - 1, Math.floor((n / max) * STEPS.length))]);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("coachTeam.heatmapEmpty")}</p>;
  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-xs" aria-label={t("coachTeam.heatmap")}>
          <thead>
            <tr>
              <th scope="col" className="sr-only">{t("coachTeam.hour")}</th>
              {WEEK_ORDER.map((d) => <th key={d} scope="col" className="px-1 font-normal text-muted-foreground">{t(`weekday.short.${d}` as MessageKey)}</th>)}
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => (
              <tr key={h}>
                <th scope="row" className="pe-1 text-end font-normal text-muted-foreground">{String(h).padStart(2, "0")}</th>
                {WEEK_ORDER.map((d) => {
                  const v = value(d, h);
                  const label = t("coachTeam.heatCell", { day: t(`weekday.${d}` as MessageKey), hour: `${String(h).padStart(2, "0")}:00`, sessions: v.sessions, visits: v.visits });
                  return <td key={d} title={label} aria-label={label} className={cn("h-5 w-9 rounded-sm border border-border/40", step(v.sessions + v.visits))} />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground" aria-hidden>
        {t("coachTeam.fewer")}
        {STEPS.map((s) => <span key={s} className={cn("h-3 w-5 rounded-sm border border-border/40", s)} />)}
        {t("coachTeam.more")}
      </div>
    </div>
  );
}
