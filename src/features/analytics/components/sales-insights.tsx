"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEGP } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useRepExtra, useSources } from "../hooks/use-analytics";

/**
 * The sales manager's month beyond the rep cards (docs/04 /sales/team): source ROI (mv_source_roi), discount usage,
 * FLAG tasks handled and how fast, expiry extensions asked (mv_rep_extra). Read-only; the same on /admin/sales.
 */
export function SalesInsights({ branch, month }: { branch: string | null; month: string }) {
  const sources = useSources(month);
  const extra = useRepExtra(month);
  const src = (sources.data ?? []).filter((s) => !branch || s.branch_id === branch).sort((a, b) => Number(b.won_revenue) - Number(a.won_revenue));
  const reps = (extra.data ?? []).filter((r) => !branch || r.branch_id === branch);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>{t("insights.sources")}</CardTitle></CardHeader>
        <CardContent>
          {sources.isError ? <p role="alert" className="text-sm text-destructive">{t("error.retryHint")}</p> : null}
          {src.length === 0 && !sources.isPending ? <p className="text-sm text-muted-foreground">{t("insights.noSources")}</p> : (
            <table className="w-full text-sm" data-testid="source-roi">
              <thead><tr className="text-muted-foreground"><th scope="col" className="text-start font-normal">{t("insights.source")}</th><th scope="col" className="text-end font-normal">{t("insights.leads")}</th><th scope="col" className="text-end font-normal">{t("insights.won")}</th><th scope="col" className="text-end font-normal">{t("insights.revenue")}</th></tr></thead>
              <tbody>{src.map((s) => <tr key={`${s.branch_id}-${s.source}`}><td>{s.source}</td><td className="text-end tabular-nums">{s.leads}</td><td className="text-end tabular-nums">{s.won}</td><td className="text-end tabular-nums">{formatEGP(Number(s.won_revenue))}</td></tr>)}</tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("insights.reps")}</CardTitle></CardHeader>
        <CardContent>
          {extra.isError ? <p role="alert" className="text-sm text-destructive">{t("error.retryHint")}</p> : null}
          <table className="w-full text-sm" data-testid="rep-extra">
            <thead><tr className="text-muted-foreground">
              <th scope="col" className="text-start font-normal">{t("insights.rep")}</th>
              <th scope="col" className="text-end font-normal">{t("insights.discounted")}</th>
              <th scope="col" className="text-end font-normal">{t("insights.discountGiven")}</th>
              <th scope="col" className="text-end font-normal">{t("insights.flagsHandled")}</th>
              <th scope="col" className="text-end font-normal">{t("insights.extensions")}</th>
            </tr></thead>
            <tbody>{reps.map((r) => (
              <tr key={r.membership_id}>
                <td>{r.full_name}</td>
                <td className="text-end tabular-nums">{r.discounted_deals}</td>
                <td className="text-end tabular-nums">{formatEGP(Number(r.discount_given_piastres))}</td>
                <td className="text-end tabular-nums">{r.flags_handled}{r.flags_median_hours !== null ? ` · ${t("insights.medianHours", { h: Number(r.flags_median_hours) })}` : ""}</td>
                <td className="text-end tabular-nums">{r.extensions_requested}</td>
              </tr>
            ))}</tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
