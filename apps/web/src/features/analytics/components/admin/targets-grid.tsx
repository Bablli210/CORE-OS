"use client";

import { useSearchParams } from "next/navigation";
import { ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/features/auth/me-context";
import { cairoMonth } from "@/lib/format";
import { t, type MessageKey } from "@/lib/i18n";
import { formatMetric } from "../../format";
import { useTargets } from "../../hooks/use-analytics";
import { useSetParams } from "../../hooks/use-set-params";
import type { TargetRow } from "../../queries/analytics";
import { MonthPicker } from "../month-picker";
import { TargetCell } from "./target-cell";

/**
 * /admin/targets (docs/04): period × scope (branch, rep, coach) × metric, inline edit. Branch targets: won revenue, new
 * clients, sessions; a rep: won revenue; a coach: sessions completed. They show as progress bars on each person's screen.
 */
export function TargetsGrid() {
  const params = useSearchParams();
  const setParams = useSetParams();
  const { branches } = useMe();
  const period = params.get("period") ?? cairoMonth();
  const targets = useTargets(period, true);
  const metric = (x: TargetRow) => t(`target.metric.${x.metric}` as MessageKey);
  const role = (x: TargetRow) => (x.scope_type === "branch" ? t("targets.branch") : t(`role.${x.role}` as MessageKey));

  return (
    <div className="grid min-w-0 gap-4 [&>*]:min-w-0">
      <PageHeader title={t("screen.admin.targets.title")} description={t("targets.description")} actions={<MonthPicker value={period} ahead={3} onChange={(m) => setParams({ period: m })} />} />
      {targets.isPending ? <LoadingList label={t("common.loading")} /> : targets.isError ? (
        <ErrorState title={t("targets.loadError")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => targets.refetch()}>{t("common.retry")}</Button>} />
      ) : branches.map((b) => {
        const rows = targets.data.filter((x) => x.branch_id === b.id).sort((x, y) => Number(y.scope_type === "branch") - Number(x.scope_type === "branch") || String(x.role).localeCompare(String(y.role)) || x.name.localeCompare(y.name) || x.metric.localeCompare(y.metric));
        return (
          <Card key={b.id}>
            <CardHeader><CardTitle>{b.name}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="targets-grid">
                <thead><tr className="text-muted-foreground">
                  <th scope="col" className="text-start font-normal">{t("targets.scope")}</th>
                  <th scope="col" className="text-start font-normal">{t("targets.metric")}</th>
                  <th scope="col" className="text-end font-normal">{t("targets.target")}</th>
                  <th scope="col" className="text-end font-normal">{t("targets.actual")}</th>
                </tr></thead>
                <tbody>{rows.map((x) => (
                  <tr key={`${x.scope_id}-${x.metric}`} className="border-t align-top">
                    <td className="py-2 pe-2"><span className="block">{x.scope_type === "branch" ? b.name : x.name}</span><span className="text-xs text-muted-foreground">{role(x)}</span></td>
                    <td className="py-2 pe-2">{metric(x)}{x.unit === "money" ? <span className="ms-1 text-xs text-muted-foreground">(EGP)</span> : null}</td>
                    <td className="py-2"><div className="flex justify-end"><TargetCell row={x} period={period} label={t("targets.cellLabel", { name: x.scope_type === "branch" ? b.name : x.name, metric: metric(x) })} /></div></td>
                    <td className="py-2 text-end tabular-nums" data-testid="target-actual">{formatMetric(x.unit, x.actual)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
