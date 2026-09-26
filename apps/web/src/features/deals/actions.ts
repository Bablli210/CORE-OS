"use server";

import type { MessageKey } from "@gymos/i18n";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@gymos/api/deals/labels";

export type PaymentResult = {
  error?: MessageKey;
  errorVars?: Record<string, string>;
  dealStatus?: string;
  clientId?: string;
  provisioned?: boolean;
  provisionFailed?: boolean;
  settledSessions?: number;
};

/**
 * Records a payment through fn_record_payment (as the signed-in user), then — docs/03 §9 — invokes provision-client
 * when the deal's client has no login yet. Provisioning failure does not undo the payment; the screen says so.
 */
export async function recordPayment(input: { dealId: string; amountPiastres: number; method: PaymentMethod; reference?: string; receivedAt?: string }): Promise<PaymentResult> {
  if (!Number.isInteger(input.amountPiastres) || input.amountPiastres <= 0) return { error: "payment.error.amount" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_record_payment", {
    p_deal_id: input.dealId,
    p_amount: input.amountPiastres,
    p_method: input.method,
    p_reference: input.reference || undefined,
    p_received_at: input.receivedAt || undefined,
  });
  if (error) {
    const over = error.message.match(/overpayment: (\d+) remaining/);
    if (over) return { error: "payment.error.overpayment", errorVars: { remaining: String(Number(over[1]) / 100) } };
    const min = error.message.match(/at least ([\d.]+) percent/);
    if (min) return { error: "payment.error.minFirst", errorVars: { pct: min[1] } };
    if (error.code === "42501") return { error: "error.notAllowed" };
    if (error.message.includes("must be approved")) return { error: "payment.error.notApproved" };
    return { error: "error.generic" };
  }
  const r = data as { client_id: string; deal_status: string; settled_sessions: number };

  const { data: client } = await supabase.from("clients").select("profile_id").eq("id", r.client_id).maybeSingle();
  let provisioned = !!client?.profile_id;
  let provisionFailed = false;
  if (!provisioned) {
    const { data: p, error: pe } = await supabase.functions.invoke("provision-client", { body: { client_id: r.client_id } });
    provisioned = !pe && !!(p as { ok?: boolean } | null)?.ok;
    provisionFailed = !provisioned;
  }
  return { dealStatus: r.deal_status, clientId: r.client_id, provisioned, provisionFailed, settledSessions: r.settled_sessions };
}
