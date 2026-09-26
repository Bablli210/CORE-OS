import { RowList, Section } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dealStatusLabel, methodLabel, productTypeLabel, type DealStatus } from "@gymos/api/deals/labels";
import { formatDate, formatDateTime, formatEGP } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import type { CommissionReport, MoneySummary } from "@gymos/api/admin/money";

function Breakdown({ title, entries, label }: { title: string; entries: Record<string, number>; label: (k: string) => string }) {
  const rows = Object.entries(entries);
  return (
    <Section title={title}>
      {rows.length ? (
        <ul className="grid gap-2 text-sm">
          {rows.map(([k, v]) => (
            <li key={k} className="flex justify-between gap-2">
              <span>{label(k)}</span>
              <span className="tabular-nums">{formatEGP(v)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("money.none")}</p>
      )}
    </Section>
  );
}

export function CollectedBreakdowns({ summary }: { summary: MoneySummary }) {
  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-4">
      <Breakdown title={t("money.byMethod")} entries={summary.by_method} label={(k) => t(methodLabel(k))} />
      <Breakdown title={t("money.byType")} entries={summary.by_type} label={(k) => t(productTypeLabel(k))} />
    </div>
  );
}

export function LiabilityTable({ report }: { report: CommissionReport }) {
  return (
    <Section title={t("money.liability")} description={t("money.liabilityHint")}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="text-muted-foreground"><tr className="border-b"><th className="py-2 text-start font-medium">{t("money.coach")}</th><th className="py-2 text-start font-medium">{t("money.clients")}</th><th className="py-2 text-start font-medium">{t("money.creditsLeft")}</th><th className="py-2 text-start font-medium">{t("money.expiring30")}</th><th className="py-2 text-end font-medium">{t("money.value")}</th></tr></thead>
          <tbody>
            {report.liability.map((l, i) => (
              <tr key={i} className="border-b last:border-0"><td className="py-2">{l.coach_name ?? "—"}</td><td className="py-2 tabular-nums">{l.clients}</td><td className="py-2 tabular-nums">{l.credits_remaining}</td><td className="py-2 tabular-nums">{l.credits_expiring_30d ?? 0}</td><td className="py-2 text-end tabular-nums">{formatEGP(l.liability_piastres)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export function UnpaidList({ summary }: { summary: MoneySummary }) {
  const rows = summary.unpaid_sessions;
  return (
    <Section title={t("money.unpaidTitle")} count={rows.length} description={t("money.unpaidHint")} plain>
      {rows.length ? (
        <RowList>
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm md:p-4">
              <span className="font-medium">{s.client_name}</span>
              <span className="text-muted-foreground">{s.coach_name} · {formatDateTime(s.scheduled_at)}</span>
            </li>
          ))}
        </RowList>
      ) : (
        <p className="rounded-lg border bg-card p-3 text-sm text-muted-foreground md:p-4">{t("money.noUnpaid")}</p>
      )}
    </Section>
  );
}

export function PaymentsList({ summary, onRefund }: { summary: MoneySummary; onRefund?: (p: MoneySummary["payments"][number]) => void }) {
  return (
    <Section title={t("money.payments")} count={summary.payments.length} plain>
      <RowList>
        {summary.payments.slice(0, 30).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm md:px-4" data-testid="money-payment">
            <span className={p.voided_at ? "text-muted-foreground line-through" : ""}>
              <span className="font-medium">{p.name}</span> · {t(methodLabel(p.method))} · {formatDate(p.received_at)}
            </span>
            <span className="flex items-center gap-2 tabular-nums">
              {formatEGP(p.amount_piastres)}
              {onRefund && !p.voided_at ? (
                <Button size="sm" variant="ghost" onClick={() => onRefund(p)} aria-label={t("refund.for", { name: p.name, amount: formatEGP(p.amount_piastres) })}>
                  {t("refund.button")}
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </RowList>
    </Section>
  );
}

export function RecentDeals({ summary }: { summary: MoneySummary }) {
  return (
    <Section title={t("money.deals")} count={summary.deals.length} plain>
      <RowList>
        {summary.deals.slice(0, 30).map((d) => (
          <li key={d.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm md:px-4">
            <span>
              <span className="font-medium">{d.name}</span> · {d.rep_name} · {formatDate(d.created_at)}
            </span>
            <span className="flex items-center gap-2 tabular-nums">
              <Badge variant="outline">{t(dealStatusLabel(d.status as DealStatus))}</Badge>
              {formatEGP(d.paid_piastres)} / {formatEGP(d.total_piastres)}
            </span>
          </li>
        ))}
      </RowList>
    </Section>
  );
}
