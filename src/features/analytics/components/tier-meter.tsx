import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TierMeter as Meter } from "../queries/analytics";

/**
 * The PT commission tier meter (docs/04 /coach/numbers): sessions burned this month against the tier bands
 * ("148 / 160 to 40%"). The tier reached applies to the whole month.
 */
export function TierMeter({ meter }: { meter: Meter }) {
  const bands = meter.tiers;
  const lastFinite = Math.max(...bands.map((b) => b.up_to ?? 0));
  const scaleMax = Math.max(lastFinite + 40, meter.sessions + 10);
  let from = 0;
  return (
    <div className="grid gap-2" data-testid="tier-meter" data-sessions={meter.sessions} data-pct={meter.pct}>
      <p className="text-sm">
        {meter.next_pct !== null && meter.tier_up_to !== null
          ? t("tier.toNext", { sessions: meter.sessions, upTo: meter.tier_up_to, next: meter.next_pct })
          : t("tier.top", { sessions: meter.sessions })}
        {" · "}
        <span className="font-semibold">{t("tier.current", { pct: meter.pct })}</span>
      </p>
      <div className="relative flex h-3 w-full overflow-hidden rounded-full" role="meter" aria-valuemin={0} aria-valuemax={scaleMax} aria-valuenow={meter.sessions} aria-label={t("tier.aria", { sessions: meter.sessions, pct: meter.pct })}>
        {bands.map((b, i) => {
          const to = b.up_to ?? scaleMax;
          const width = (100 * (to - from)) / scaleMax;
          const filled = Math.max(0, Math.min(1, (meter.sessions - from) / (to - from)));
          from = to;
          return (
            <div key={i} className={cn("relative h-full bg-seq-1", i > 0 && "border-s-2 border-background")} style={{ width: `${width}%` }}>
              <div className="h-full bg-series-1" style={{ width: `${filled * 100}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex text-xs text-muted-foreground" aria-hidden>
        {bands.map((b, i) => {
          const prev = i === 0 ? 0 : (bands[i - 1].up_to ?? 0);
          const to = b.up_to ?? scaleMax;
          return <span key={i} style={{ width: `${(100 * (to - prev)) / scaleMax}%` }}>{b.up_to ? t("tier.band", { from: prev, to: b.up_to, pct: b.pct }) : t("tier.bandTop", { from: prev + 1, pct: b.pct })}</span>;
        })}
      </div>
    </div>
  );
}
