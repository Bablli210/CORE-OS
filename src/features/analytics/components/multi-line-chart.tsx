"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { t } from "@/lib/i18n";
import { formatMetric } from "../format";
import type { Unit } from "../queries/analytics";

export type Series = { key: string; name: string; slot: number };

const short = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const dateLabel = (d: string) => short.format(new Date(`${String(d).slice(0, 10)}T00:00:00Z`));

/**
 * Lines over weeks, one per entity (branch, coach). Colour follows the entity through a fixed slot (--series-N, the
 * tokens' validated order), never its rank. One y-axis; 2px lines; legend below; hover tooltip; the same numbers in a
 * table one tap away (and required: some light slots are under 3:1 on white).
 */
export function MultiLineChart({ data, series, unit, title, xKey = "week_start" }: { data: Record<string, string | number>[]; series: Series[]; unit: Unit; title: string; xKey?: string }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">{t("chart.empty")}</p>;
  return (
    <figure className="grid gap-2">
      <div className="h-56 w-full" role="img" aria-label={t("chart.label", { title, n: series.length })}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-chart-grid)" vertical={false} />
            <XAxis dataKey={xKey} tickFormatter={dateLabel} tick={{ fill: "var(--color-chart-axis)", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={16} reversed={false} />
            <YAxis width={56} tick={{ fill: "var(--color-chart-axis)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMetric(unit, Number(v), { compact: true })} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, color: "var(--color-popover-foreground)" }}
              labelFormatter={(d) => t("chart.weekOf", { date: dateLabel(String(d)) })}
              formatter={(v, name) => [formatMetric(unit, Number(v)), name]}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-muted-foreground)" }} iconType="plainline" />
            {series.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={`var(--color-series-${s.slot})`} strokeWidth={2}
                dot={{ r: 3, strokeWidth: 2, fill: "var(--color-background)" }} activeDot={{ r: 5 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{title}</figcaption>
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">{t("progress.showTable")}</summary>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-sm">
            <thead><tr><th scope="col" className="text-start font-medium">{t("chart.week")}</th>{series.map((s) => <th key={s.key} scope="col" className="text-end font-medium">{s.name}</th>)}</tr></thead>
            <tbody>{data.map((d) => <tr key={String(d[xKey])}><td>{dateLabel(String(d[xKey]))}</td>{series.map((s) => <td key={s.key} className="text-end tabular-nums">{formatMetric(unit, Number(d[s.key] ?? 0))}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
