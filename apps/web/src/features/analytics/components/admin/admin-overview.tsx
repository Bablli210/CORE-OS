"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/features/auth/me-context";
import { cairoMonth } from "@gymos/api/format";
import { t, type MessageKey } from "@gymos/i18n";
import { useTargets, useTiles } from "@gymos/api/analytics/use-analytics";
import { useSetParams } from "../../hooks/use-set-params";
import { MonthPicker } from "../month-picker";
import { TargetBar } from "../target-bar";
import { TileGrid } from "../tile-grid";
import { BranchCompare } from "./branch-compare";
import { BranchSelect } from "./branch-select";
import { Reconciliation } from "./reconciliation";
import { TodayStrip } from "./today-strip";
import { WeeklyTrends } from "./weekly-trends";

const GROUPS: { title: MessageKey; keys: string[] }[] = [
  { title: "overview.money", keys: ["booked", "collected", "delivered", "delivered_net"] },
  { title: "overview.commission", keys: ["coach_commission", "rep_commission"] },
  { title: "overview.clients", keys: ["new_clients", "lapsed", "net_clients"] },
  { title: "overview.sessions", keys: ["sessions", "no_show_pct", "unpaid"] },
];

/** /admin (docs/04): live today, the month's tiles for a branch or both, reconciliation, A vs B, 12-week trends, targets. */
export function AdminOverview() {
  const params = useSearchParams();
  const setParams = useSetParams();
  const { branches } = useMe();
  const month = params.get("month") ?? cairoMonth();
  const branch = params.get("branch") ?? "";
  const scope = branch || null;
  const tiles = useTiles("admin", month, scope);
  const targets = useTargets(month);
  const branchTargets = (targets.data ?? []).filter((x) => x.scope_type === "branch" && (!branch || x.scope_id === branch));
  const name = (id: string) => branches.find((b) => b.id === id)?.name ?? "";

  return (
    <div className="grid min-w-0 gap-4 [&>*]:min-w-0">
      <PageHeader
        title={t("screen.admin.overview.title")}
        description={t("overview.description")}
        actions={<div className="flex flex-wrap gap-2"><BranchSelect value={branch} onChange={(v) => setParams({ branch: v || null })} /><MonthPicker value={month} onChange={(m) => setParams({ month: m })} /></div>}
      />
      <TodayStrip />
      {tiles.isPending ? <LoadingList label={t("common.loading")} /> : tiles.isError || !tiles.data ? (
        <ErrorState title={t("numbers.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => tiles.refetch()}>{t("common.retry")}</Button>} />
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle>{t("overview.reconcile")}</CardTitle></CardHeader>
            <CardContent><Reconciliation tiles={tiles.data.tiles} month={month} scope={scope} /></CardContent>
          </Card>
          {GROUPS.map((g) => (
            <section key={g.title} className="grid gap-2" aria-label={t(g.title)}>
              <h2 className="text-sm font-medium text-muted-foreground">{t(g.title)}</h2>
              <TileGrid tiles={tiles.data.tiles.filter((x) => g.keys.includes(x.key.replace("admin.", "")))} month={month} scope={scope} />
            </section>
          ))}
          <p className="text-xs text-muted-foreground">{t("numbers.refresh")}</p>
        </>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("overview.targets")}</CardTitle>
          <Link href={`/admin/targets?period=${month}`} className="text-sm underline-offset-2 hover:underline">{t("overview.editTargets")}</Link>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {branchTargets.filter((x) => x.target !== null).length === 0 ? <p className="text-sm text-muted-foreground">{t("overview.noTargets")}</p> : null}
          {branchTargets.filter((x) => x.target !== null).map((x) => (
            <TargetBar key={`${x.scope_id}-${x.metric}`} actual={Number(x.actual ?? 0)} target={Number(x.target)} unit={x.unit} label={`${name(x.scope_id)} · ${t(`target.metric.${x.metric}` as MessageKey)}`} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("overview.compare")}</CardTitle></CardHeader>
        <CardContent><BranchCompare month={month} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("overview.trends")}</CardTitle></CardHeader>
        <CardContent><WeeklyTrends /></CardContent>
      </Card>
    </div>
  );
}
