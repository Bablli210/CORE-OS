import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import type { DealStatus, PaymentMethod, ProductType } from "../labels";

type Fns = Database["public"]["Functions"];
export type CatalogItem = Fns["fn_deal_catalog"]["Returns"][number];
export type BranchCoach = Fns["fn_branch_coaches"]["Returns"][number];
export type RankedCoach = Fns["fn_rank_coaches"]["Returns"][number];
export type DealRow = Fns["fn_sales_deals"]["Returns"][number];

export type DealItem = {
  id: string;
  product_id: string;
  product_name: string;
  product_type: ProductType;
  qty: number;
  unit_price_piastres: number;
  line_total_piastres: number;
  session_count: number | null;
  duration_days: number | null;
  expiry_days: number | null;
  provider_membership_id: string | null;
  provider_name: string | null;
  credits_issued: number;
  per_session_piastres: number | null;
  net_per_session_piastres: number | null;
};
export type DealPayment = {
  id: string;
  amount_piastres: number;
  method: PaymentMethod;
  reference: string | null;
  received_at: string;
  recorded_by: string | null;
  voided_at: string | null;
  void_reason: string | null;
  void_pending: boolean;
};
export type Deal = {
  id: string;
  branch_id: string;
  branch_name: string;
  status: DealStatus;
  lead: { id: string; full_name: string; phone: string; status: string } | null;
  client: { id: string; full_name: string; phone: string; provisioned: boolean; coach_name: string | null } | null;
  rep_name: string | null;
  closer_name: string | null;
  is_renewal: boolean;
  subtotal_piastres: number;
  discount_pct: number;
  discount_fixed_piastres: number;
  discount_piastres: number;
  total_piastres: number;
  paid_piastres: number;
  remaining_piastres: number;
  min_first_payment_piastres: number | null;
  payment_plan: "single" | "installments";
  installments_count: number;
  notes: string | null;
  created_at: string;
  tax_pct: number;
  items: DealItem[];
  issues: string[];
  approval: { id: string; type: string; status: string; reason: string | null; requested_by: string | null; decided_by: string | null; decided_at: string | null; decision_note: string | null } | null;
  approval_preview: { needs_approval: boolean; reasons: string[]; allowance_pct: number; effective_pct: number } | null;
  payments: DealPayment[];
  timeline: { type: string; occurred_at: string; actor: string | null; payload: Record<string, unknown> }[];
  can_edit: boolean;
  can_pay: boolean;
  can_cancel: boolean;
  can_request_void: boolean;
};
export type DraftItem = { product_id: string; qty: number; provider_membership_id: string | null };
export type Draft = { items: DraftItem[]; discount_pct: number; discount_fixed_piastres: number; payment_plan: "single" | "installments"; installments_count: number; notes: string };

export const dealKeys = {
  all: ["deals"] as const,
  list: (branchId: string, status?: string, search?: string) => ["deals", "list", branchId, status ?? "", search ?? ""] as const,
  detail: (id: string) => ["deals", "detail", id] as const,
  catalog: (branchId: string) => ["deals", "catalog", branchId] as const,
  coaches: (branchId: string) => ["deals", "coaches", branchId] as const,
  ranked: (leadId?: string, clientId?: string) => ["deals", "ranked", leadId ?? "", clientId ?? ""] as const,
};

const db = () => createClient();
function unwrap<T>({ data, error }: { data: unknown; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export const fetchCatalog = async (branchId: string): Promise<CatalogItem[]> => unwrap(await db().rpc("fn_deal_catalog", { p_branch_id: branchId }));
export const fetchCoaches = async (branchId: string): Promise<BranchCoach[]> => unwrap(await db().rpc("fn_branch_coaches", { p_branch_id: branchId }));
export const fetchRanked = async (leadId?: string, clientId?: string): Promise<RankedCoach[]> =>
  unwrap(await db().rpc("fn_rank_coaches", leadId ? { p_lead_id: leadId } : { p_client_id: clientId }));
export const fetchDeal = async (id: string): Promise<Deal> => unwrap(await db().rpc("fn_deal", { p_deal_id: id }));
export const fetchDeals = async (branchId: string, status?: DealStatus, search?: string): Promise<DealRow[]> =>
  unwrap(await db().rpc("fn_sales_deals", { p_branch_id: branchId, p_status: status, p_search: search || undefined }));

export const createDeal = async (target: { leadId?: string; clientId?: string }): Promise<string> =>
  unwrap(await db().rpc("fn_create_deal", target.leadId ? { p_lead_id: target.leadId } : { p_client_id: target.clientId }));
export const saveDraft = async (dealId: string, d: Draft): Promise<Deal> =>
  unwrap(
    await db().rpc("fn_save_deal_draft", {
      p_deal_id: dealId,
      p_items: d.items,
      p_discount_pct: d.discount_pct,
      p_discount_fixed_piastres: d.discount_fixed_piastres,
      p_payment_plan: d.payment_plan,
      p_installments_count: d.installments_count,
      p_notes: d.notes,
    }),
  );
export const submitDeal = async (id: string) => unwrap(await db().rpc("fn_submit_deal", { p_deal_id: id }));
export const cancelDeal = async (id: string, reason: string) => unwrap(await db().rpc("fn_cancel_deal", { p_deal_id: id, p_reason: reason }));
export const requestVoid = async (paymentId: string, reason: string): Promise<string> => unwrap(await db().rpc("fn_request_payment_void", { p_payment_id: paymentId, p_reason: reason }));
