"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { t } from "@gymos/i18n";

type Point = { date: string; value: number };

const short = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Cairo" });
const label = (d: string) => short.format(new Date(`${d.slice(0, 10)}T12:00:00Z`));

/**
 * One series over time (top set, body weight). The card title names the series, so no legend. Tokens only: the line is
 * --chart-1, grid and axes are recessive; hover shows the value; the same numbers are in a table one tap away.
 */
export function TrendChart({ points, unit, name }: { points: Point[]; unit: string; name: string }) {
  if (points.length === 0) return null;
  return (
    <div className="grid gap-2">
      <div className="h-48 w-full" role="img" aria-label={t("progress.chartLabel", { name, n: points.length })}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="date" tickFormatter={label} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} domain={["dataMin - 5", "dataMax + 5"]} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }}
              labelFormatter={(d) => label(String(d))}
              formatter={(v) => [`${v} ${unit}`, name]}
            />
            <Line type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "var(--background)" }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">{t("progress.showTable")}</summary>
        <table className="mt-2 w-full text-sm">
          <thead><tr><th scope="col" className="text-start font-medium">{t("progress.date")}</th><th scope="col" className="text-end font-medium">{name}</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.date}><td>{label(p.date)}</td><td className="text-end tabular-nums">{p.value} {unit}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}
