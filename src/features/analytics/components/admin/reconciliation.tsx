import Link from "next/link";
import { formatEGP } from "@/lib/format";
import { t } from "@/lib/i18n";
import { rowsHref, type Tile } from "../../queries/analytics";

/**
 * The month's money, reconciled: booked − collected on those deals = outstanding; deferred = the liability view
 * (credits sold, not yet delivered). Figures are the admin tiles; each opens its rows.
 */
export function Reconciliation({ tiles, month, scope }: { tiles: Tile[]; month: string; scope: string | null }) {
  const v = (k: string) => Number(tiles.find((x) => x.key === `admin.${k}`)?.value ?? 0);
  const link = (k: string, label: string) => (
    <Link href={rowsHref(`admin.${k}`, month, scope)} className="grid gap-0.5 rounded-md bg-muted p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`recon-${k}`} data-value={v(k)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{formatEGP(v(k))}</span>
    </Link>
  );
  const balanced = v("booked") - v("collected_on_booked") === v("outstanding");
  return (
    <div className="grid gap-3" data-testid="reconciliation" data-balanced={balanced}>
      <div className="grid grid-cols-1 items-center gap-1 text-center sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-2">
        {link("booked", t("metric.admin.booked"))}
        <span aria-hidden>−</span>
        {link("collected_on_booked", t("metric.admin.collected_on_booked"))}
        <span aria-hidden>=</span>
        {link("outstanding", t("metric.admin.outstanding"))}
      </div>
      <p className="sr-only">{t("recon.equation")}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {link("deferred", t("metric.admin.deferred"))}
        <p className="text-xs text-muted-foreground">{t("recon.deferredNote")}</p>
      </div>
      {!balanced ? <p role="alert" className="text-sm text-destructive">{t("recon.unbalanced")}</p> : null}
    </div>
  );
}
