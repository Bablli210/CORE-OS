"use client";

import { useSearchParams } from "next/navigation";
import { ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/features/auth/me-context";
import { useTeam } from "@gymos/api/sales/use-sales";
import { cairoMonth, formatEGP } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { useTiles } from "@gymos/api/analytics/use-analytics";
import { useSetParams } from "../../hooks/use-set-params";
import { MonthPicker } from "../month-picker";
import { SalesInsights } from "../sales-insights";
import { TileGrid } from "../tile-grid";
import { BranchSelect } from "./branch-select";

/** /admin/sales: the sales manager's team screen for a branch, read-only (tiles, reps, source ROI, discounts, flags). */
export function AdminSales() {
  const params = useSearchParams();
  const setParams = useSetParams();
  const { branches } = useMe();
  const month = params.get("month") ?? cairoMonth();
  const branch = params.get("branch") || branches[0]?.id || "";
  const tiles = useTiles("sales", month, branch, !!branch);
  const team = useTeam(branch, month);

  return (
    <div className="grid min-w-0 gap-4 [&>*]:min-w-0">
      <PageHeader
        title={t("screen.admin.sales.title")}
        description={t("adminTeam.salesDescription")}
        actions={<div className="flex flex-wrap gap-2"><BranchSelect value={branch} allowAll={false} onChange={(v) => setParams({ branch: v })} /><MonthPicker value={month} onChange={(m) => setParams({ month: m })} /></div>}
      />
      {tiles.isPending ? <LoadingList label={t("common.loading")} /> : tiles.isError || !tiles.data ? (
        <ErrorState title={t("numbers.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => tiles.refetch()}>{t("common.retry")}</Button>} />
      ) : <TileGrid tiles={tiles.data.tiles} month={month} scope={branch} />}
      <Card>
        <CardHeader><CardTitle>{t("adminTeam.reps")}</CardTitle><p className="text-sm text-muted-foreground">{t("team.refreshNote")}</p></CardHeader>
        <CardContent className="overflow-x-auto">
          {team.isError ? <p role="alert" className="text-sm text-destructive">{t("error.retryHint")}</p> : null}
          {team.data?.length === 0 ? <p className="text-sm text-muted-foreground">{t("adminTeam.noReps")}</p> : (
            <table className="w-full text-sm" data-testid="admin-reps">
              <thead><tr className="text-muted-foreground">
                <th scope="col" className="text-start font-normal">{t("insights.rep")}</th>
                <th scope="col" className="text-end font-normal">{t("team.leads")}</th>
                <th scope="col" className="text-end font-normal">{t("team.won")}</th>
                <th scope="col" className="text-end font-normal">{t("team.conversion")}</th>
                <th scope="col" className="text-end font-normal">{t("team.response")}</th>
                <th scope="col" className="text-end font-normal">{t("metric.rep.won_revenue")}</th>
                <th scope="col" className="text-end font-normal">{t("metric.rep.commission")}</th>
                <th scope="col" className="text-end font-normal">{t("team.flags")}</th>
              </tr></thead>
              <tbody>{(team.data ?? []).map((r) => (
                <tr key={r.membership_id} className="border-t">
                  <td className="py-1.5">{r.full_name}{r.rotation_paused ? <span className="ms-1 text-xs text-muted-foreground">({t("team.paused")})</span> : null}</td>
                  <td className="text-end tabular-nums">{r.leads}</td>
                  <td className="text-end tabular-nums">{r.won}</td>
                  <td className="text-end tabular-nums">{r.conversion_pct}%</td>
                  <td className="text-end tabular-nums">{r.median_response_min === null ? "—" : `${r.median_response_min}m`}</td>
                  <td className="text-end tabular-nums">{formatEGP(r.won_revenue)}</td>
                  <td className="text-end tabular-nums">{formatEGP(r.commission_piastres)}</td>
                  <td className="text-end tabular-nums">{r.open_flags}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <SalesInsights branch={branch} month={month} />
    </div>
  );
}
