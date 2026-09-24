import { createClient } from "@/lib/supabase/client";

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
