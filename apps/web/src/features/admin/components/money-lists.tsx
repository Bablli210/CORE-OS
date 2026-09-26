import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dealStatusLabel, methodLabel, productTypeLabel, type DealStatus } from "@/features/deals/labels";
import { formatDate, formatDateTime, formatEGP } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { CommissionReport, MoneySummary } from "../queries/money";

function Breakdown({ title, entries, label }: { title: string; entries: Record<string, number>; label: (k: string) => string }) {
  const rows = Object.entries(entries);
  return (
    <section className="grid gap-2 rounded-lg border p-4">
      <h2 className="font-semibold">{title}</h2>
      {rows.length ? <ul className="grid gap-1 text-sm">{rows.map(([k, v]) => <li key={k} className="flex justify-between"><span>{label(k)}</span><span>{formatEGP(v)}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">{t("money.none")}</p>}
    </section>
  );
}

export function CollectedBreakdowns({ summary }: { summary: MoneySummary }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Breakdown title={t("money.byMethod")} entries={summary.by_method} label={(k) => t(methodLabel(k))} />
      <Breakdown title={t("money.byType")} entries={summary.by_type} label={(k) => t(productTypeLabel(k))} />
    </div>
  );
}

export function LiabilityTable({ report }: { report: CommissionReport }) {
  return (
    <section aria-labelledby="liab" className="grid gap-2 overflow-x-auto">
      <h2 id="liab" className="font-semibold">{t("money.liability")}</h2>
      <table className="w-full min-w-[32rem] text-sm">
        <thead className="text-muted-foreground"><tr className="border-b"><th className="py-2 text-start font-medium">{t("money.coach")}</th><th className="py-2 text-start font-medium">{t("money.clients")}</th><th className="py-2 text-start font-medium">{t("money.creditsLeft")}</th><th className="py-2 text-start font-medium">{t("money.expiring30")}</th><th className="py-2 text-start font-medium">{t("money.value")}</th></tr></thead>
        <tbody>
          {report.liability.map((l, i) => (
            <tr key={i} className="border-b last:border-0"><td className="py-2">{l.coach_name ?? "—"}</td><td className="py-2">{l.clients}</td><td className="py-2">{l.credits_remaining}</td><td className="py-2">{l.credits_expiring_30d ?? 0}</td><td className="py-2">{formatEGP(l.liability_piastres)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function RecentLists({ summary, onRefund }: { summary: MoneySummary; onRefund?: (p: MoneySummary["payments"][number]) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="grid gap-2 rounded-lg border p-4">
        <h2 className="font-semibold">{t("money.unpaid", { n: summary.unpaid_sessions.length })}</h2>
        {summary.unpaid_sessions.length ? <ul className="grid gap-1 text-sm">{summary.unpaid_sessions.map((s) => <li key={s.id}>{s.client_name} · {s.coach_name} · {formatDateTime(s.scheduled_at)}</li>)}</ul> : <p className="text-sm text-muted-foreground">{t("money.noUnpaid")}</p>}
      </section>
      <section className="grid gap-2 rounded-lg border p-4">
        <h2 className="font-semibold">{t("money.payments")}</h2>
        <ul className="grid gap-1 text-sm">{summary.payments.slice(0, 15).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2" data-testid="money-payment">
            <span className={p.voided_at ? "line-through" : ""}>{p.name} · {t(methodLabel(p.method))} · {formatDate(p.received_at)}</span>
            <span className="flex items-center gap-2">{formatEGP(p.amount_piastres)}
              {onRefund && !p.voided_at ? <Button size="sm" variant="ghost" onClick={() => onRefund(p)} aria-label={t("refund.for", { name: p.name, amount: formatEGP(p.amount_piastres) })}>{t("refund.button")}</Button> : null}
            </span>
          </li>
        ))}</ul>
      </section>
      <section className="grid gap-2 rounded-lg border p-4 md:col-span-2">
        <h2 className="font-semibold">{t("money.deals")}</h2>
        <ul className="grid gap-1 text-sm">{summary.deals.slice(0, 15).map((d) => (
          <li key={d.id} className="flex flex-wrap justify-between gap-2"><span>{d.name} · {d.rep_name} · {formatDate(d.created_at)}</span><span className="flex gap-2"><Badge variant="outline">{t(dealStatusLabel(d.status as DealStatus))}</Badge>{formatEGP(d.paid_piastres)} / {formatEGP(d.total_piastres)}</span></li>
        ))}</ul>
      </section>
    </div>
  );
}
