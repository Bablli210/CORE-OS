"use client";

import { useSearchParams } from "next/navigation";
import { ErrorState, LoadingList } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthPicker } from "@/features/analytics/components/month-picker";
import { TargetBar } from "@/features/analytics/components/target-bar";
import { TileGrid } from "@/features/analytics/components/tile-grid";
import { useTargets, useTiles } from "@/features/analytics/hooks/use-analytics";
import { useSetParams } from "@/features/analytics/hooks/use-set-params";
import { useMe } from "@/features/auth/me-context";
import { lostReasonLabel, sourceLabel, type LostReason } from "@/features/leads/labels";
import { cairoMonth } from "@/lib/format";
import { t, type MessageKey } from "@/lib/i18n";
import { useNumbers } from "../hooks/use-sales";

/**
 * /sales/numbers: a rep's month (won revenue vs target, leads, conversion, response, membership collected and
 * commission, overdue, flags); the sales manager's branch. Tiles come from fn_dashboard_tiles and open their rows.
 */
export function NumbersScreen() {
  const me = useMe();
  const params = useSearchParams();
  const setParams = useSetParams();
  const month = params.get("month") ?? cairoMonth();
  const isRep = me.active.role === "sales_rep";
  const screen = isRep ? "rep" : "sales";
  const scope = isRep ? me.active.id : me.active.branchId;
  const tiles = useTiles(screen, month, scope, !!scope);
  const targets = useTargets(month);
  const breakdown = useNumbers(me.active.branchId ?? "", month);
  const mine = (targets.data ?? []).filter((x) => (isRep ? x.scope_id === me.active.id : x.scope_type === "branch" && x.scope_id === me.active.branchId));
  const bySource = (breakdown.data?.breakdown ?? []).filter((b) => b.dimension === "source");
  const lost = (breakdown.data?.breakdown ?? []).filter((b) => b.dimension === "lost_reason");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("numbers.refresh")}</p>
        <MonthPicker value={month} onChange={(m) => setParams({ month: m })} />
      </div>
      {tiles.isPending ? <LoadingList label={t("common.loading")} /> : tiles.isError || !tiles.data ? (
        <ErrorState title={t("numbers.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => tiles.refetch()}>{t("common.retry")}</Button>} />
      ) : <TileGrid tiles={tiles.data.tiles} month={month} scope={scope} />}
      {mine.length ? (
        <Card>
          <CardHeader><CardTitle>{isRep ? t("target.yours") : t("target.branch")}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {mine.map((x) => <TargetBar key={x.metric} actual={Number(x.actual ?? 0)} target={Number(x.target)} unit={x.unit} label={t(`target.metric.${x.metric}` as MessageKey)} />)}
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("numbers.bySource")}</CardTitle></CardHeader>
          <CardContent>
            {bySource.length ? (
              <ul className="grid gap-1 text-sm">{bySource.map((b) => <li key={b.key} className="flex justify-between"><span>{t(sourceLabel(b.key))}</span><span className="font-medium">{b.n}</span></li>)}</ul>
            ) : <p className="text-sm text-muted-foreground">{t("numbers.none")}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("numbers.lostReasons")}</CardTitle></CardHeader>
          <CardContent>
            {lost.length ? (
              <ul className="grid gap-1 text-sm">{lost.map((b) => <li key={b.key} className="flex justify-between"><span>{t(lostReasonLabel(b.key as LostReason))}</span><span className="font-medium">{b.n}</span></li>)}</ul>
            ) : <p className="text-sm text-muted-foreground">{t("numbers.noneLost")}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
