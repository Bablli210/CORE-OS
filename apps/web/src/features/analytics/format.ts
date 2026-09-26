import { formatEGP } from "@gymos/api/format";
import type { Unit } from "@gymos/api/analytics/analytics";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en");

/** A metric's value as a tile shows it (money in EGP from piastres; the database did the arithmetic). */
export function formatMetric(unit: Unit, value: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const v = Number(value);
  switch (unit) {
    case "money":
      return opts.compact && Math.abs(v) >= 10_000_000 ? `EGP ${compact.format(v / 100)}` : formatEGP(v);
    case "pct":
      return `${v}%`;
    case "minutes":
      return v < 120 ? `${Math.round(v)}m` : `${Math.round(v / 6) / 10}h`;
    default:
      return opts.compact && Math.abs(v) >= 10_000 ? compact.format(v) : whole.format(v);
  }
}

/** A chart axis tick: short (38K, not EGP 38,000), the unit named once in the chart's title. */
export function axisTick(unit: Unit, value: number): string {
  if (unit === "money") return compact.format(value / 100);
  if (unit === "pct") return `${value}%`;
  return compact.format(value);
}

/** Share of a target reached, 0–100+ (whole percent), or null without a target. */
export function progressPct(actual: number | null | undefined, target: number | null | undefined): number | null {
  if (!target || target <= 0) return null;
  return Math.round((100 * Number(actual ?? 0)) / Number(target));
}

/** The unit of the rows behind a metric (the drill-down's amount column and footer). */
export function rowsUnit(metric: string): Unit {
  if (/(won_revenue|booked|collected|outstanding|delivered|deferred|commission)$/.test(metric)) return "money";
  if (/(pct|conversion|retention)$/.test(metric)) return "pct";
  if (/response$/.test(metric)) return "minutes";
  return "count";
}

/** The unit of each row's amount column (burned sessions carry their net value, response rows their minutes). */
export function rowAmountUnit(metric: string): Unit {
  if (/(burned|commission|won_revenue|booked|collected|outstanding|delivered|deferred)$/.test(metric)) return "money";
  if (/response$/.test(metric)) return "minutes";
  return "count";
}
