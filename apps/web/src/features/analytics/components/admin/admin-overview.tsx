"use client";

import { GettingStarted } from "@/features/guide/components/getting-started";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { PageTabs, Section, Stack } from "@/components/layout";
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

const TABS = ["summary", "branches", "trends"] as const;
type Tab = (typeof TABS)[number];

/**
 * /admin (docs/04), in three tabs so it reads in one screen each: Summary (live today, reconciliation, the month's tiles,
 * targets), Branches (A vs B) and Trends (12 weeks). ?tab= keeps the tab in the URL.
 */
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
  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "summary";
  const hrefFor = (k: string) => {
    const next = new URLSearchParams(params);
    if (k === "summary") next.delete("tab");
    else next.set("tab", k);
    return `/admin${next.size ? `?${next}` : ""}`;
  };

  return (
    <div className="grid min-w-0 [&>*]:min-w-0">
      <PageHeader
        title={t("screen.admin.overview.title")}
        description={t("overview.description")}
        actions={<div className="flex flex-wrap gap-2"><BranchSelect value={branch} onChange={(v) => setParams({ branch: v || null })} /><MonthPicker value={month} onChange={(m) => setParams({ month: m })} /></div>}
      />
      <div className="mb-6 empty:hidden"><GettingStarted /></div>
      <PageTabs label={t("overview.tabs")} active={tab} hrefFor={hrefFor} tabs={TABS.map((k) => ({ key: k, label: t(`overview.tab.${k}` as MessageKey) }))} />
      {tab === "summary" ? (
        <Stack>
          <TodayStrip />
          {tiles.isPending ? <LoadingList label={t("common.loading")} /> : tiles.isError || !tiles.data ? (
            <ErrorState title={t("numbers.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => tiles.refetch()}>{t("common.retry")}</Button>} />
          ) : (
            <>
              <Section title={t("overview.reconcile")} description={t("overview.reconcileHint")}>
                <Reconciliation tiles={tiles.data.tiles} month={month} scope={scope} />
              </Section>
              {GROUPS.map((g) => (
                <Section key={g.title} title={t(g.title)} plain>
                  <TileGrid tiles={tiles.data.tiles.filter((x) => g.keys.includes(x.key.replace("admin.", "")))} month={month} scope={scope} />
                </Section>
              ))}
              <p className="text-xs text-muted-foreground">{t("numbers.refresh")}</p>
            </>
          )}
          <Section
            title={t("overview.targets")}
            action={<Link href={`/admin/targets?period=${month}`} className="text-sm underline-offset-2 hover:underline">{t("overview.editTargets")}</Link>}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {branchTargets.filter((x) => x.target !== null).length === 0 ? <p className="text-sm text-muted-foreground">{t("overview.noTargets")}</p> : null}
              {branchTargets.filter((x) => x.target !== null).map((x) => (
                <TargetBar key={`${x.scope_id}-${x.metric}`} actual={Number(x.actual ?? 0)} target={Number(x.target)} unit={x.unit} label={`${name(x.scope_id)} · ${t(`target.metric.${x.metric}` as MessageKey)}`} />
              ))}
            </div>
          </Section>
        </Stack>
      ) : tab === "branches" ? (
        <Section title={t("overview.compare")} description={t("overview.compareHint")}>
          <BranchCompare month={month} />
        </Section>
      ) : (
        <Section title={t("overview.trends")}>
          <WeeklyTrends />
        </Section>
      )}
    </div>
  );
}
