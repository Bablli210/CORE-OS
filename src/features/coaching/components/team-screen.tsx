"use client";

import Link from "next/link";
import { useState } from "react";
import { ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/features/auth/me-context";
import { cairoMonth, daysSince } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useBranchAdherence, useHeatmap, useTeam } from "../hooks/use-coaching";
import { AuditPanel } from "./audit-panel";
import { CoachesTable } from "./coaches-table";
import { Heatmap } from "./heatmap";
import { ReassignPanel } from "./reassign-panel";

/** /coach/team — head coach only (docs/04): schedules and coaches, reassignment, audit, branch adherence, heatmap. */
export function TeamScreen() {
  const me = useMe();
  const branch = me.active.branchId;
  const month = cairoMonth();
  const team = useTeam(branch, month);
  const adherence = useBranchAdherence();
  const heatmap = useHeatmap();
  const [notice, setNotice] = useState("");

  if (team.isPending) return <LoadingList label={t("common.loading")} />;
  if (team.isError || !team.data) return <ErrorState title={t("coachTeam.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => team.refetch()}>{t("common.retry")}</Button>} />;
  const low = (adherence.data ?? []).filter((a) => a.branch_id === branch && a.adherence_pct !== null).sort((a, b) => (a.adherence_pct ?? 0) - (b.adherence_pct ?? 0)).slice(0, 10);

  return (
    <div className="grid gap-4">
      <PageHeader title={t("coachTeam.title")} description={t("coachTeam.description", { month })} />
      <p role="status" className="min-h-5 text-sm text-success">{notice}</p>
      <Card>
        <CardHeader><CardTitle>{t("coachTeam.audit")}</CardTitle></CardHeader>
        <CardContent><AuditPanel team={team.data} onDone={setNotice} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("coachTeam.coaches")}</CardTitle><p className="text-sm text-muted-foreground">{t("team.refreshNote")}</p></CardHeader>
        <CardContent><CoachesTable coaches={team.data.coaches} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("coachTeam.reassignTitle")}</CardTitle></CardHeader>
        <CardContent><ReassignPanel clients={team.data.clients} onDone={setNotice} /></CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("coachTeam.adherence")}</CardTitle><p className="text-sm text-muted-foreground">{t("team.refreshNote")}</p></CardHeader>
          <CardContent>
            {adherence.isError ? <p role="alert" className="text-sm text-destructive">{t("error.retryHint")}</p> : null}
            {low.length === 0 && !adherence.isPending ? <p className="text-sm text-muted-foreground">{t("coachTeam.noAdherence")}</p> : null}
            <ul className="grid gap-1 text-sm">
              {low.map((a) => (
                <li key={a.client_id!} className="flex justify-between gap-2">
                  <Link href={`/coach/clients/${a.client_id}`} className="hover:underline">{a.full_name}</Link>
                  <span className="text-muted-foreground">{t("coachTeam.adherenceLine", { pct: a.adherence_pct ?? 0, noShows: a.no_shows_30d ?? 0, days: a.last_visit_at ? daysSince(a.last_visit_at) : "—" })}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("coachTeam.heatmap")}</CardTitle><p className="text-sm text-muted-foreground">{t("coachTeam.heatmapNote")}</p></CardHeader>
          <CardContent>
            {heatmap.isError ? <p role="alert" className="text-sm text-destructive">{t("error.retryHint")}</p> : null}
            <Heatmap rows={(heatmap.data ?? []).filter((r) => r.branch_id === branch)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
