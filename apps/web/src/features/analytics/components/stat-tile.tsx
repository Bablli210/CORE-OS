import { ChevronRight, Radio } from "lucide-react";
import Link from "next/link";
import { t, type MessageKey } from "@gymos/i18n";
import { cn } from "@/lib/utils";
import { formatMetric, progressPct } from "../format";
import type { Tile } from "@gymos/api/analytics/analytics";
import { TargetBar } from "./target-bar";

/**
 * docs/04 StatTile: label, value, target progress, one line of context. The whole tile is a link to the rows behind the
 * number (fn_dashboard_rows), whose count or total equals the value.
 */
export function StatTile({ tile, href, sub }: { tile: Tile; href: string; sub?: string }) {
  const label = t(`metric.${tile.key}` as MessageKey);
  const pct = progressPct(tile.value, tile.target ?? null);
  return (
    <Link
      href={href}
      data-testid="stat-tile"
      data-key={tile.key}
      data-value={tile.value ?? ""}
      aria-label={t("tile.open", { label, value: formatMetric(tile.unit, tile.value) })}
      className="group grid min-w-0 content-start gap-1 rounded-lg border bg-card p-3 hover:bg-accent md:p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-start justify-between gap-2 text-sm text-muted-foreground">
        <span className="min-w-0 leading-snug">{label}</span>
        {tile.live ? <Radio aria-label={t("tile.live")} className="size-3.5" /> : <ChevronRight aria-hidden className="size-4 opacity-0 group-hover:opacity-100 rtl:rotate-180" />}
      </span>
      <span className="break-words text-xl font-semibold tabular-nums leading-tight md:text-2xl">{formatMetric(tile.unit, tile.value)}</span>
      {pct !== null ? <TargetBar actual={tile.value ?? 0} target={tile.target!} unit={tile.unit} compact /> : null}
      {sub ? <span className={cn("text-xs text-muted-foreground")}>{sub}</span> : null}
    </Link>
  );
}
