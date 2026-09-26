"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageTabs, Stack } from "@/components/layout";
import { ErrorState, LoadingList } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useMe } from "@/features/auth/me-context";
import { cairoMonth, formatEGP } from "@gymos/api/format";
import { t, type MessageKey } from "@gymos/i18n";
import { fetchMoney, moneyKeys, type MoneySummary } from "@gymos/api/admin/money";
import { monthLabel } from "@/features/analytics/components/month-picker";
import { CommissionTables } from "./commission-tables";
import { CollectedBreakdowns, LiabilityTable, PaymentsList, RecentDeals, UnpaidList } from "./money-lists";
import { MoneyRequests, RefundSheet } from "./money-requests";

const TABS = ["summary", "commission", "payments"] as const;
type Tab = (typeof TABS)[number];

function lastMonths(n: number): string[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => cairoMonth(new Date(now.getFullYear(), now.getMonth() - i, 15)));
}

function Tile({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="grid min-w-0 content-start gap-1 rounded-lg border bg-card p-3 md:p-4">
      <span className="text-sm leading-snug text-muted-foreground">{label}</span>
      <span className="break-words text-xl font-semibold tabular-nums" data-testid={testId}>{value}</span>
    </div>
  );
}

/**
 * /admin/money in three tabs — Summary (the month's totals, how it was paid, unpaid sessions), Commission (payroll and
 * the liability per coach), Payments and deals (with refunds and transfers). All figures are computed in the database.
 */
export function MoneyScreen() {
  const { branches } = useMe();
  const params = useSearchParams();
  const pathname = usePathname();
  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "summary";
  const months = lastMonths(12);
  const [month, setMonth] = useState(months[0]);
  const [branch, setBranch] = useState("");
  const [refunding, setRefunding] = useState<MoneySummary["payments"][number] | null>(null);
  const [notice, setNotice] = useState("");
  const { data, isPending, isError, refetch } = useQuery({ queryKey: moneyKeys.all(month, branch), queryFn: () => fetchMoney(month, branch || null) });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label><span className="sr-only">{t("money.month")}</span><Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-48">{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</Select></label>
        <label><span className="sr-only">{t("money.branch")}</span>
          <Select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-56"><option value="">{t("shell.allBranches")}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
        </label>
        <p className="text-xs text-muted-foreground">{t("team.refreshNote")}</p>
      </div>
      <PageTabs label={t("money.tabs")} active={tab} hrefFor={(k) => (k === "summary" ? pathname : `${pathname}?tab=${k}`)} tabs={TABS.map((k) => ({ key: k, label: t(`money.tab.${k}` as MessageKey) }))} />
      <p role="status" className="text-sm text-success empty:hidden">{notice}</p>
      {refunding ? <RefundSheet payment={refunding} onClose={() => setRefunding(null)} onDone={() => { setRefunding(null); setNotice(t("refund.sent")); }} /> : null}
      {isPending ? <LoadingList label={t("common.loading")} /> : isError ? (
        <ErrorState title={t("money.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />
      ) : tab === "summary" ? (
        <Stack>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Tile label={t("money.booked")} value={formatEGP(data.summary.booked_piastres)} />
            <Tile label={t("money.collected")} value={formatEGP(data.summary.collected_piastres)} />
            <Tile label={t("money.voided")} value={formatEGP(data.summary.voided_piastres)} />
            <Tile label={t("money.deferred")} value={formatEGP(data.report.liability_total_piastres)} testId="liability-total" />
            <Tile label={t("money.unpaidTile")} value={String(data.summary.unpaid_sessions.length)} />
          </div>
          <CollectedBreakdowns summary={data.summary} />
          <UnpaidList summary={data.summary} />
        </Stack>
      ) : tab === "commission" ? (
        <Stack>
          <CommissionTables report={data.report} />
          <LiabilityTable report={data.report} />
        </Stack>
      ) : (
        <Stack>
          <MoneyRequests month={month} branch={branch} />
          <PaymentsList summary={data.summary} onRefund={setRefunding} />
          <RecentDeals summary={data.summary} />
        </Stack>
      )}
    </div>
  );
}
