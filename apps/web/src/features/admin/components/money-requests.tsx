"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { dealErrorKey } from "@/features/deals/errors";
import { useMoneyMutation } from "@/features/deals/hooks/use-deals";
import { formatDate, formatDateTime, formatEGP } from "@/lib/format";
import { t, type MessageKey } from "@/lib/i18n";
import { fetchMoneyRequests, requestKeys, requestRefund, type MoneySummary } from "../queries/money";

const statusBadge = (s: string) => (s === "approved" ? "success" : s === "rejected" ? "destructive" : "warning");

/** Refunds and transfers this month (and any still waiting): who asked, why, and what the sales manager decided. */
export function MoneyRequests({ month, branch }: { month: string; branch: string }) {
  const { data = [], isError } = useQuery({ queryKey: requestKeys.all(month, branch), queryFn: () => fetchMoneyRequests(month, branch || null) });
  return (
    <section aria-labelledby="mreq" className="grid gap-2 rounded-lg border p-4" data-testid="money-requests">
      <h2 id="mreq" className="font-semibold">{t("money.requests")}</h2>
      <p className="text-sm text-muted-foreground">{t("money.requestsHint")}</p>
      {isError ? <p role="alert" className="text-sm text-destructive">{t("error.retryHint")}</p> : null}
      {data.length === 0 ? <p className="text-sm text-muted-foreground">{t("money.noRequests")}</p> : (
        <ul className="grid gap-2">
          {data.map((r) => (
            <li key={r.id} className="grid gap-1 rounded-md border p-3 text-sm" data-testid="money-request" data-type={r.type} data-status={r.status}>
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{t(`approval.type.${r.type}` as MessageKey)} · {r.type === "refund"
                  ? t("money.refundLine", { name: r.client_name ?? "", amount: formatEGP(r.amount_piastres ?? 0) })
                  : t("money.transferLine", { from: r.client_name ?? "", to: r.to_client_name ?? "", n: r.qty ?? 0, coach: r.coach_name ?? "" })}</span>
                <Badge variant={statusBadge(r.status)}>{t(`money.requestStatus.${r.status}` as MessageKey)}</Badge>
              </span>
              <span className="text-muted-foreground">{[r.requested_by, formatDateTime(r.requested_at), r.reason && `“${r.reason}”`].filter(Boolean).join(" · ")}</span>
              {r.decided_at ? <span className="text-muted-foreground">{t("money.decided", { by: r.decided_by ?? "", date: formatDate(r.decided_at) })}{r.note ? ` · ${r.note}` : ""}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Ask for a refund of one payment. The sales manager approves it in /sales/queue; then the payment is voided. */
export function RefundSheet({ payment, onClose, onDone }: { payment: MoneySummary["payments"][number]; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const m = useMoneyMutation(() => requestRefund(payment.id, reason.trim()));
  return (
    <Sheet open onClose={onClose} title={t("refund.title")} closeLabel={t("common.close")}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (reason.trim()) m.mutate(undefined, { onSuccess: onDone }); }}>
        <p className="text-sm">{t("refund.what", { name: payment.name, amount: formatEGP(payment.amount_piastres), date: formatDate(payment.received_at) })}</p>
        <Field label={t("common.reasonRequired")} htmlFor="refund-reason"><Textarea id="refund-reason" className="font-sans" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <p className="text-sm text-muted-foreground">{t("refund.hint")}</p>
        {m.isError ? <p role="alert" className="text-sm text-destructive">{t(dealErrorKey(m.error))}</p> : null}
        <Button type="submit" size="block" disabled={!reason.trim() || m.isPending}>{t("refund.send")}</Button>
      </form>
    </Sheet>
  );
}
