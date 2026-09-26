"use client";

import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatEGP } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { PaymentResult } from "../actions";
import { methodLabel } from "../labels";
import { cancelDeal, requestVoid, type Deal } from "../queries/deals";
import { DealSummary } from "./deal-summary";
import { DealTimeline } from "./deal-timeline";
import { PaymentSheet } from "./payment-sheet";
import { ReasonSheet } from "./reason-sheet";

/** A submitted deal: approval state, items with credits released, payments (record, void), timeline. */
export function DealView({ deal }: { deal: Deal }) {
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const coach = deal.items.find((i) => i.product_type === "pt_pack")?.provider_name;

  return (
    <div className="grid gap-4 pb-24 md:grid-cols-[1fr_20rem] md:pb-0">
      <div className="grid content-start gap-4">
        {deal.status === "pending_approval" && deal.approval ? (
          <p className="flex items-start gap-2 rounded-md border border-warning bg-warning/10 p-3 text-sm" role="status" data-testid="deal-banner">
            <Clock aria-hidden className="mt-0.5 size-4" />{t("deal.waitingApproval", { by: deal.approval.requested_by ?? "" })}
          </p>
        ) : null}
        {deal.status === "cancelled" && deal.approval?.status === "rejected" ? (
          <p className="rounded-md border border-destructive/50 p-3 text-sm" role="status">{t("deal.rejected", { by: deal.approval.decided_by ?? "", note: deal.approval.decision_note ?? "" })}</p>
        ) : null}
        {result ? (
          <p className="flex items-start gap-2 rounded-md border border-success p-3 text-sm" role="status" data-testid="payment-banner">
            <CheckCircle2 aria-hidden className="mt-0.5 size-4 text-success" />
            <span>
              {result.provisioned && coach ? t("payment.clientCreated", { coach }) : t("payment.recorded")}
              {result.settledSessions ? ` ${t("payment.settled", { n: result.settledSessions })}` : ""}
              {result.provisionFailed ? ` ${t("payment.provisionFailed")}` : ""}
            </span>
          </p>
        ) : null}
        <Card>
          <CardHeader><CardTitle>{t("deal.items")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {deal.items.map((i) => (
                <li key={i.id} className="flex flex-wrap justify-between gap-2 text-sm" data-testid="deal-item">
                  <span className="grid">
                    <span className="font-medium">{i.product_name}{i.provider_name ? ` · ${i.provider_name}` : ""}</span>
                    {i.product_type === "pt_pack" ? (
                      <span className="text-xs text-muted-foreground" data-testid="credits-released">
                        {t("deal.creditsReleased", { issued: i.credits_issued, total: (i.session_count ?? 0) * i.qty })} · {t("deal.perSession", { gross: formatEGP(i.per_session_piastres ?? 0), net: formatEGP(i.net_per_session_piastres ?? 0) })}
                      </span>
                    ) : null}
                  </span>
                  <span>{formatEGP(i.line_total_piastres)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("deal.payments")}</CardTitle></CardHeader>
          <CardContent>
            {deal.payments.length === 0 ? <p className="text-sm text-muted-foreground">{t("deal.noPayments")}</p> : null}
            <ul className="grid gap-2">
              {deal.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm" data-testid="payment-row">
                  <span className="grid">
                    <span className={p.voided_at ? "line-through" : "font-medium"}>{formatEGP(p.amount_piastres)} · {t(methodLabel(p.method))}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(p.received_at)}{p.recorded_by ? ` · ${p.recorded_by}` : ""}{p.reference ? ` · ${p.reference}` : ""}</span>
                  </span>
                  {p.voided_at ? <Badge variant="destructive">{t("payment.voided")}</Badge> : p.void_pending ? <Badge variant="warning">{t("payment.voidPending")}</Badge> : deal.can_request_void ? (
                    <Button size="sm" variant="outline" onClick={() => setVoiding(p.id)}>{t("payment.void")}</Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("deal.timeline")}</CardTitle></CardHeader>
          <CardContent><DealTimeline events={deal.timeline} /></CardContent>
        </Card>
      </div>
      <div className="grid content-start gap-3">
        <DealSummary deal={deal} />
        {deal.client ? <Link href={`/sales/clients/${deal.client.id}`} className={buttonVariants({ variant: "outline" })}>{t("deal.openClient", { name: deal.client.full_name })}</Link> : null}
        {deal.can_cancel ? <Button variant="outline" onClick={() => setCancelling(true)}>{t("deal.cancel")}</Button> : null}
        {deal.can_pay && deal.remaining_piastres > 0 ? (
          <div className="fixed inset-x-0 bottom-bottom-bar z-20 border-t bg-background p-3 md:static md:border-0 md:p-0">
            <Button size="block" onClick={() => setPaying(true)}>{t("payment.record")}</Button>
          </div>
        ) : null}
      </div>
      {paying ? <PaymentSheet deal={deal} open onClose={() => setPaying(false)} onRecorded={setResult} /> : null}
      {voiding ? <ReasonSheet open onClose={() => setVoiding(null)} title={t("payment.voidTitle")} action={t("payment.voidExplain")} submitLabel={t("payment.requestVoid")} run={(r) => requestVoid(voiding, r)} /> : null}
      {cancelling ? <ReasonSheet open onClose={() => setCancelling(false)} title={t("deal.cancelTitle")} action={t("deal.cancelExplain")} submitLabel={t("deal.cancel")} run={(r) => cancelDeal(deal.id, r)} /> : null}
    </div>
  );
}
