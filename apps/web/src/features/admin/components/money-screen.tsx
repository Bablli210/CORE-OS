"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorState, LoadingList } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useMe } from "@/features/auth/me-context";
import { cairoMonth, formatEGP } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { fetchMoney, moneyKeys, type MoneySummary } from "@gymos/api/admin/money";
import { CommissionTables } from "./commission-tables";
import { CollectedBreakdowns, LiabilityTable, RecentLists } from "./money-lists";
import { MoneyRequests, RefundSheet } from "./money-requests";

function lastMonths(n: number): string[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => cairoMonth(new Date(now.getFullYear(), now.getMonth() - i, 15)));
}

function Tile({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return <div className="grid gap-1 rounded-lg border p-4"><span className="text-sm text-muted-foreground">{label}</span><span className="text-xl font-semibold" data-testid={testId}>{value}</span></div>;
}

/** /admin/money: month close, deferred liability, the commission report, refunds and transfers — all computed in the database. */
export function MoneyScreen() {
  const { branches } = useMe();
  const months = lastMonths(12);
  const [month, setMonth] = useState(months[0]);
  const [branch, setBranch] = useState("");
  const [refunding, setRefunding] = useState<MoneySummary["payments"][number] | null>(null);
  const [notice, setNotice] = useState("");
  const { data, isPending, isError, refetch } = useQuery({ queryKey: moneyKeys.all(month, branch), queryFn: () => fetchMoney(month, branch || null) });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
        <label><span className="sr-only">{t("money.month")}</span><Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-40">{months.map((m) => <option key={m} value={m}>{m}</option>)}</Select></label>
        <label><span className="sr-only">{t("money.branch")}</span>
          <Select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-56"><option value="">{t("shell.allBranches")}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
        </label>
      </div>
      <p className="text-sm text-muted-foreground">{t("team.refreshNote")}</p>
      <p role="status" className="text-sm text-success empty:hidden">{notice}</p>
      {refunding ? <RefundSheet payment={refunding} onClose={() => setRefunding(null)} onDone={() => { setRefunding(null); setNotice(t("refund.sent")); }} /> : null}
      {isPending ? <LoadingList label={t("common.loading")} /> : isError ? (
        <ErrorState title={t("money.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Tile label={t("money.booked")} value={formatEGP(data.summary.booked_piastres)} />
            <Tile label={t("money.collected")} value={formatEGP(data.summary.collected_piastres)} />
            <Tile label={t("money.voided")} value={formatEGP(data.summary.voided_piastres)} />
            <Tile label={t("money.deferred")} value={formatEGP(data.report.liability_total_piastres)} testId="liability-total" />
            <Tile label={t("money.unpaidTile")} value={String(data.summary.unpaid_sessions.length)} />
          </div>
          <CollectedBreakdowns summary={data.summary} />
          <LiabilityTable report={data.report} />
          <CommissionTables report={data.report} />
          <MoneyRequests month={month} branch={branch} />
          <RecentLists summary={data.summary} onRefund={setRefunding} />
        </>
      )}
    </div>
  );
}
