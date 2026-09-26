import { CheckCircle2 } from "lucide-react";
import { t } from "@gymos/i18n";
import { cn } from "@/lib/utils";
import { formatMetric, progressPct } from "../format";
import type { Unit } from "@gymos/api/analytics/analytics";

/**
 * Progress toward a target (a meter): the fill is the accent, the track a light step of the same ramp; reached = the
 * success colour plus a check icon and the word, never colour alone.
 */
export function TargetBar({ actual, target, unit, label, compact = false }: { actual: number; target: number; unit: Unit; label?: string; compact?: boolean }) {
  const pct = progressPct(actual, target) ?? 0;
  const reached = pct >= 100;
  return (
    <div className="grid gap-1" data-testid="target-bar" data-pct={pct}>
      {label ? <span className="text-sm">{label}</span> : null}
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={Number(target)}
        aria-valuenow={Number(actual)}
        aria-label={t("target.aria", { actual: formatMetric(unit, actual), target: formatMetric(unit, target) })}
        className={cn("w-full overflow-hidden rounded-full bg-seq-1", compact ? "h-1.5" : "h-2.5")}
      >
        <div className={cn("h-full rounded-full", reached ? "bg-success" : "bg-series-1")} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {reached ? <CheckCircle2 aria-hidden className="size-3 text-success" /> : null}
        {t(reached ? "target.reached" : "target.of", { pct, target: formatMetric(unit, target, { compact: true }) })}
      </span>
    </div>
  );
}
