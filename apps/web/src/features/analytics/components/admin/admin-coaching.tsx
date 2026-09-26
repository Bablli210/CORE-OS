"use client";

import { useSearchParams } from "next/navigation";
import { ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/features/auth/me-context";
import { CoachesTable } from "@/features/coaching/components/coaches-table";
import { Heatmap } from "@/features/coaching/components/heatmap";
import { useBranchAdherence, useHeatmap, useTeam } from "@/features/coaching/hooks/use-coaching";
import { cairoMonth } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useTiles } from "../../hooks/use-analytics";
import { useSetParams } from "../../hooks/use-set-params";
import { CoachWeeksChart } from "../coach-weeks-chart";
import { MonthPicker } from "../month-picker";
import { TileGrid } from "../tile-grid";
import { BranchSelect } from "./branch-select";

const COACHING = ["admin.sessions", "admin.no_show_pct", "admin.unpaid", "admin.delivered_net", "admin.coach_commission"];

/** /admin/coaching: the head coach's team screen for a branch, read-only (tiles, coaches, sessions per week, adherence, heatmap). */
export function AdminCoaching() {
  const params = useSearchParams();
  const setParams = useSetParams();
  const { branches } = useMe();
  const month = params.get("month") ?? cairoMonth();
  const branch = params.get("branch") || branches[0]?.id || "";
  const tiles = useTiles("admin", month, branch, !!branch);
  const team = useTeam(branch, month);
  const adherence = useBranchAdherence();
  const heatmap = useHeatmap();
  const low = (adherence.data ?? []).filter((a) => a.branch_id === branch && a.adherence_pct !== null).sort((a, b) => (a.adherence_pct ?? 0) - (b.adherence_pct ?? 0)).slice(0, 10);

  return (
    <div className="grid min-w-0 gap-4 [&>*]:min-w-0">
      <PageHeader
        title={t("screen.admin.coaching.title")}
        description={t("adminTeam.coachingDescription")}
        actions={<div className="flex flex-wrap gap-2"><BranchSelect value={branch} allowAll={false} onChange={(v) => setParams({ branch: v })} /><MonthPicker value={month} onChange={(m) => setParams({ month: m })} /></div>}
      />
      {tiles.isPending ? <LoadingList label={t("common.loading")} /> : tiles.isError || !tiles.data ? (
        <ErrorState title={t("numbers.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => tiles.refetch()}>{t("common.retry")}</Button>} />
      ) : <TileGrid tiles={tiles.data.tiles.filter((x) => COACHING.includes(x.key))} month={month} scope={branch} columns="md:grid-cols-5" />}
      <Card>
        <CardHeader><CardTitle>{t("coachTeam.coaches")}</CardTitle><p className="text-sm text-muted-foreground">{t("team.refreshNote")}</p></CardHeader>
        <CardContent>
          {team.isError ? <p role="alert" className="text-sm text-destructive">{t("error.retryHint")}</p> : null}
          {team.isPending ? <LoadingList label={t("common.loading")} /> : <CoachesTable coaches={team.data?.coaches ?? []} readOnly />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("coachTeam.perWeek")}</CardTitle></CardHeader>
        <CardContent><CoachWeeksChart branch={branch} /></CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("coachTeam.adherence")}</CardTitle></CardHeader>
          <CardContent>
            {low.length === 0 && !adherence.isPending ? <p className="text-sm text-muted-foreground">{t("coachTeam.noAdherence")}</p> : null}
            <ul className="grid gap-1 text-sm">
              {low.map((a) => (
                <li key={a.client_id!} className="flex justify-between gap-2">
                  <span>{a.full_name}</span>
                  <span className="text-muted-foreground">{t("adminTeam.adherenceLine", { pct: a.adherence_pct ?? 0, noShows: a.no_shows_30d ?? 0 })}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("coachTeam.heatmap")}</CardTitle><p className="text-sm text-muted-foreground">{t("coachTeam.heatmapNote")}</p></CardHeader>
          <CardContent><Heatmap rows={(heatmap.data ?? []).filter((r) => r.branch_id === branch)} branch={branch} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
