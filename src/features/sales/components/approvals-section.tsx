"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dealErrorKey } from "@/features/deals/errors";
import { useMoneyMutation } from "@/features/deals/hooks/use-deals";
import { approvalTypeLabel, methodLabel } from "@/features/deals/labels";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatDateTime, formatEGP } from "@/lib/format";
import { t } from "@/lib/i18n";

type Approval = {
  id: string;
  type: string;
  reason: string | null;
  requested_at: string;
  requested_by: string | null;
  payload: Record<string, unknown>;
  deal: { id: string; name: string; total_piastres: number; subtotal_piastres: number; discount_piastres: number; payment_plan: string; installments_count: number } | null;
  payment: { id: string; deal_id: string; amount_piastres: number; method: string; received_at: string; name: string } | null;
  lot: { id: string; client_id: string; name: string; qty_remaining: number; coach_name: string; expires_at: string; status: string } | null;
  freeze: { name: string; days: number } | null;
  lead: { id: string; name: string; to: string } | null;
};

async function fetchApprovals(branchId: string): Promise<Approval[]> {
  const { data, error } = await createClient().rpc("fn_sales_approvals", { p_branch_id: branchId });
  if (error) throw error;
  return data as Approval[];
}

/** Pending approvals for the sales manager: what it is, who asked, why; approve or reject with a note (fn_decide_approval). */
export function ApprovalsSection({ branchId }: { branchId: string }) {
  const { data = [], isPending } = useQuery({ queryKey: ["approvals", branchId], queryFn: () => fetchApprovals(branchId) });
  return (
    <section aria-labelledby="q-approvals" data-testid="queue-approvals" className="grid gap-2">
      <h2 id="q-approvals" className="font-semibold">{t("queue.approvals")} <span className="text-muted-foreground">({data.length})</span></h2>
      {isPending ? null : data.length === 0 ? <p className="text-sm text-muted-foreground">{t("queue.nothing")}</p> : (
        <ul className="grid gap-2">{data.map((a) => <ApprovalItem key={a.id} a={a} />)}</ul>
      )}
    </section>
  );
}

function ApprovalItem({ a }: { a: Approval }) {
  const [note, setNote] = useState("");
  const decide = useMoneyMutation(async (approve: boolean) => {
    const { error } = await createClient().rpc("fn_decide_approval", { p_approval_id: a.id, p_approve: approve, p_note: note || undefined });
    if (error) throw error;
  });
  const what = a.deal
    ? <Link href={`/sales/deals/${a.deal.id}`} className="underline-offset-4 hover:underline">{t("approval.dealLine", { name: a.deal.name, total: formatEGP(a.deal.total_piastres), discount: formatEGP(a.deal.discount_piastres) })}</Link>
    : a.payment ? <Link href={`/sales/deals/${a.payment.deal_id}`} className="underline-offset-4 hover:underline">{t("approval.paymentLine", { name: a.payment.name, amount: formatEGP(a.payment.amount_piastres), method: t(methodLabel(a.payment.method)), date: formatDate(a.payment.received_at) })}</Link>
    : a.lot ? <Link href={`/sales/clients/${a.lot.client_id}`} className="underline-offset-4 hover:underline">{t("approval.lotLine", { name: a.lot.name, coach: a.lot.coach_name, from: formatDate(a.lot.expires_at), to: typeof a.payload.new_expires_at === "string" ? formatDate(a.payload.new_expires_at) : "" })}</Link>
    : a.freeze ? t("approval.freezeLine", { name: a.freeze.name, days: a.freeze.days })
    : a.lead ? t("approval.leadLine", { name: a.lead.name, to: a.lead.to }) : null;
  return (
    <li className="grid gap-2 rounded-lg border p-3" data-testid="approval-item">
      <span className="flex flex-wrap justify-between gap-2">
        <span className="font-medium">{t(approvalTypeLabel(a.type))}</span>
        <span className="text-xs text-muted-foreground">{[a.requested_by, formatDateTime(a.requested_at)].filter(Boolean).join(" · ")}</span>
      </span>
      <span className="text-sm">{what}</span>
      {a.reason ? <span className="text-sm text-muted-foreground">“{a.reason}”</span> : null}
      <Input aria-label={t("approval.note")} placeholder={t("approval.note")} value={note} onChange={(e) => setNote(e.target.value)} />
      {decide.isError ? <p role="alert" className="text-sm text-destructive">{t(dealErrorKey(decide.error))}</p> : null}
      <span className="flex gap-2">
        <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate(true)}>{t("queue.approve")}</Button>
        <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate(false)}>{t("queue.reject")}</Button>
      </span>
    </li>
  );
}
