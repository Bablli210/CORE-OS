import { createClient } from "../supabase";

export type MoneySummary = {
  booked_piastres: number;
  collected_piastres: number;
  voided_piastres: number;
  by_method: Record<string, number>;
  by_type: Record<string, number>;
  unpaid_sessions: { id: string; client_name: string; coach_name: string | null; scheduled_at: string }[];
  deals: { id: string; status: string; name: string; total_piastres: number; paid_piastres: number; rep_name: string | null; created_at: string }[];
  payments: { id: string; name: string; amount_piastres: number; method: string; received_at: string; voided_at: string | null; recorded_by: string | null }[];
};
export type CommissionReport = {
  tax_pct: number;
  membership_pct: number;
  nutrition_pct: number;
  coaches: { membership_id: string; full_name: string; sessions_burned: number; delivered_piastres: number; delivered_net_piastres: number; per_session_piastres: number | null; net_per_session_piastres: number | null; commission_pct: number; commission_piastres: number; unpaid_sessions: number }[];
  reps: { membership_id: string; full_name: string; won_revenue_piastres: number; membership_collected_piastres: number; nutrition_collected_piastres: number; pt_collected_piastres: number; commission_piastres: number }[];
  liability: { coach_membership_id: string | null; coach_name: string | null; clients: number; credits_remaining: number; liability_piastres: number; credits_expiring_30d: number | null }[];
  liability_total_piastres: number;
};

export const moneyKeys = { all: (month: string, branch: string) => ["money", month, branch] as const };

export async function fetchMoney(month: string, branchId: string | null): Promise<{ summary: MoneySummary; report: CommissionReport }> {
  const supabase = createClient();
  const args = { p_month: month, p_branch_id: branchId ?? undefined };
  const [s, r] = await Promise.all([supabase.rpc("fn_money_summary", args), supabase.rpc("fn_commission_report", args)]);
  if (s.error) throw s.error;
  if (r.error) throw r.error;
  return { summary: s.data as MoneySummary, report: r.data as CommissionReport };
}

export type MoneyRequest = {
  id: string;
  type: "refund" | "transfer";
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  note: string | null;
  requested_at: string;
  decided_at: string | null;
  requested_by: string | null;
  decided_by: string | null;
  branch_id: string | null;
  amount_piastres: number | null;
  deal_id: string | null;
  client_name: string | null;
  to_client_name: string | null;
  qty: number | null;
  coach_name: string | null;
};
export const requestKeys = { all: (month: string, branch: string) => ["money", "requests", month, branch] as const };

/** Refunds and transfers of the month, and any still pending (fn_money_requests, top management). */
export async function fetchMoneyRequests(month: string, branch: string | null): Promise<MoneyRequest[]> {
  const { data, error } = await createClient().rpc("fn_money_requests", { p_month: month, p_branch_id: branch ?? undefined });
  if (error) throw error;
  return data as MoneyRequest[];
}

/** fn_request_refund: voids the payment and withdraws the deal's unused sessions once the sales manager approves. */
export async function requestRefund(paymentId: string, reason: string): Promise<string> {
  const { data, error } = await createClient().rpc("fn_request_refund", { p_payment_id: paymentId, p_reason: reason });
  if (error) throw error;
  return data as string;
}
