"use client";

import { useSearchParams } from "next/navigation";
import { EmptyState, ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOwnCoachMembership } from "@/features/sessions/hooks/use-coach";
import { cairoMonth } from "@gymos/api/format";
import { t, type MessageKey } from "@gymos/i18n";
import { useCoachWeeks, useTargets, useTiles } from "@gymos/api/analytics/use-analytics";
import { useSetParams } from "../hooks/use-set-params";
import { MonthPicker } from "./month-picker";
import { MultiLineChart } from "./multi-line-chart";
import { TargetBar } from "./target-bar";
import { TierMeter } from "./tier-meter";
import { TileGrid } from "./tile-grid";

/**
 * /coach/numbers (docs/04): this month's sessions burned against the commission tiers, commission, no-shows, clients,
 * unpaid sessions, retention and at-risk — each tile opens its rows — plus targets and sessions per week.
 * ?month= picks the month; ?coach= is the head coach looking at a coach.
 */
export function CoachNumbers() {
  const params = useSearchParams();
  const setParams = useSetParams();
  const own = useOwnCoachMembership();
  const coach = params.get("coach") ?? own;
  const month = params.get("month") ?? cairoMonth();
  const tiles = useTiles("coach", month, coach, !!coach);
  const targets = useTargets(month);
  const weeks = useCoachWeeks(null);

  if (!coach) return <><PageHeader title={t("numbers.title")} /><EmptyState title={t("schedule.noCoach")} body={t("schedule.noCoachBody")} action={{ href: "/coach", label: t("nav.backToday") }} /></>;
  const mine = (weeks.data ?? []).filter((w) => w.membership_id === coach).map((w) => ({ week_start: String(w.week_start), sessions: Number(w.sessions_completed ?? 0) }));
  const myTargets = (targets.data ?? []).filter((x) => x.scope_id === coach);

  return (
    <div className="grid gap-4">
      <PageHeader
        title={tiles.data?.name && params.get("coach") ? t("numbers.titleOf", { name: tiles.data.name }) : t("numbers.title")}
        description={t("numbers.description")}
        actions={<MonthPicker value={month} onChange={(m) => setParams({ month: m })} />}
      />
      {tiles.isPending ? <LoadingList label={t("common.loading")} /> : tiles.isError || !tiles.data ? (
        <ErrorState title={t("numbers.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => tiles.refetch()}>{t("common.retry")}</Button>} />
      ) : (
        <>
          {tiles.data.meter ? (
            <Card>
              <CardHeader><CardTitle>{t("tier.title")}</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                <TierMeter meter={tiles.data.meter} />
                <details className="text-sm text-muted-foreground">
                  <summary className="cursor-pointer">{t("tier.how")}</summary>
                  <p className="mt-2">{t("tier.formula")}</p>
                </details>
              </CardContent>
            </Card>
          ) : null}
          <TileGrid tiles={tiles.data.tiles} month={month} scope={coach} />
          <p className="text-xs text-muted-foreground">{t("numbers.refresh")}</p>
        </>
      )}
      {myTargets.length ? (
        <Card>
          <CardHeader><CardTitle>{t("target.yours")}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {myTargets.map((x) => <TargetBar key={x.metric} actual={Number(x.actual ?? 0)} target={Number(x.target)} unit={x.unit} label={t(`target.metric.${x.metric}` as MessageKey)} />)}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader><CardTitle>{t("numbers.perWeek")}</CardTitle></CardHeader>
        <CardContent>
          <MultiLineChart data={mine} series={[{ key: "sessions", name: t("numbers.sessionsCompleted"), slot: 1 }]} unit="count" title={t("numbers.perWeek")} />
        </CardContent>
      </Card>
    </div>
  );
}
