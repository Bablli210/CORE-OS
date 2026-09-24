"use client";

import { ErrorState, LoadingList } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/features/auth/me-context";
import { lostReasonLabel, sourceLabel, type LostReason } from "@/features/leads/labels";
import { cairoMonth, formatEGP } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useNumbers } from "../hooks/use-sales";
import type { RepMonth } from "../queries/sales";

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="grid gap-1 rounded-lg border p-4" data-testid="stat-tile">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
      {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

/** /sales/numbers: this month's tiles from fn_dashboard_reps (mv_rep_month), leads by source and lost reasons. */
export function NumbersScreen() {
  const me = useMe();
  const month = cairoMonth();
  const { data, isPending, isError, refetch } = useNumbers(me.active.branchId ?? "", month, me.active.id);
  if (isPending) return <LoadingList label={t("common.loading")} />;
  if (isError) return <ErrorState title={t("numbers.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />;

  // A rep sees their own row; the manager sees the branch total.
  const sum = (k: keyof RepMonth) => data.rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const leads = sum("leads");
  const won = sum("won");
  const medians = data.rows.map((r) => r.median_response_min).filter((v): v is number => v !== null);
  const bySource = data.breakdown.filter((b) => b.dimension === "source");
  const lost = data.breakdown.filter((b) => b.dimension === "lost_reason");

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t("numbers.month", { month })} · {t("team.refreshNote")}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label={t("numbers.wonRevenue")} value={formatEGP(sum("won_revenue"))} sub={data.target ? t("numbers.ofTarget", { target: formatEGP(data.target) }) : undefined} />
        <Tile label={t("numbers.leads")} value={String(leads)} />
        <Tile label={t("numbers.conversion")} value={leads ? `${Math.round((100 * won) / leads)}%` : "—"} sub={t("numbers.wonOf", { won, leads })} />
        <Tile label={t("numbers.response")} value={medians.length ? `${Math.round(medians.reduce((a, b) => a + b, 0) / medians.length)}m` : "—"} />
        <Tile label={t("numbers.overdue")} value={String(sum("overdue_follow_ups_now"))} />
      </div>
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
