import Link from "next/link";
import { rowsHref } from "@/features/analytics/queries/analytics";
import { WEEK_ORDER } from "@/features/sessions/week";
import { cairoMonth } from "@/lib/format";
import { t, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { HeatmapRow } from "../queries/coaching";

// Sequential: one hue light → dark (--seq-1…5, tokens.css); an empty cell stays the surface.
const STEPS = ["bg-seq-1", "bg-seq-2", "bg-seq-3", "bg-seq-4", "bg-seq-5"];

/**
 * Weekday × hour, sessions + visits over the last 8 weeks (mv_heatmap via fn_dashboard_heatmap). A table, so it reads as
 * data; every cell is a link to the sessions and visits behind it.
 */
export function Heatmap({ rows, branch }: { rows: HeatmapRow[]; branch: string }) {
  const hours = Array.from(new Set(rows.map((r) => r.hr!))).sort((a, b) => a - b);
  const value = (dow: number, hr: number) => {
    const r = rows.find((x) => x.dow === dow && x.hr === hr);
    return { sessions: r?.sessions ?? 0, visits: r?.visits ?? 0 };
  };
  const max = Math.max(1, ...rows.map((r) => (r.sessions ?? 0) + (r.visits ?? 0)));
  const step = (n: number) => (n === 0 ? "bg-transparent" : STEPS[Math.min(STEPS.length - 1, Math.floor(((n - 1) / max) * STEPS.length))]);
  const month = cairoMonth();
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("coachTeam.heatmapEmpty")}</p>;
  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-xs" aria-label={t("coachTeam.heatmap")} data-testid="heatmap">
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
                  const n = v.sessions + v.visits;
                  const label = t("coachTeam.heatCell", { day: t(`weekday.${d}` as MessageKey), hour: `${String(h).padStart(2, "0")}:00`, sessions: v.sessions, visits: v.visits });
                  return (
                    <td key={d} className="p-0">
                      <Link
                        href={rowsHref("heatmap.cell", month, branch, { dow: d, hr: h })}
                        title={label}
                        aria-label={label}
                        data-testid="heat-cell"
                        data-n={n}
                        className={cn("block h-6 w-9 rounded-sm border border-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", step(n))}
                      />
                    </td>
                  );
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
