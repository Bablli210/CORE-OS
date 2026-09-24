import { createClient } from "@/lib/supabase/client";

export type Lot = {
  id: string;
  coach_name: string | null;
  qty_issued: number;
  qty_remaining: number;
  per_session_piastres: number;
  issued_at: string;
  expires_at: string;
  status: "active" | "exhausted" | "expired" | "refunded";
  expired_qty: number | null;
  pending_extension: { id: string; new_expires_at: string; requested_by: string | null } | null;
};
export type SalesClient = {
  id: string;
  full_name: string;
  phone: string;
  status: string;
  branch_name: string;
  joined_at: string;
  rep_name: string | null;
  coach_name: string | null;
  provisioned: boolean;
  lead_id: string | null;
  balances: { coach_membership_id: string; coach_name: string; balance: number; next_expiry: string }[];
  lots: Lot[];
  entitlements: { id: string; type: string; product_name: string | null; starts_at: string; ends_at: string; status: string }[];
  deals: { id: string; status: string; total_piastres: number; paid_piastres: number; created_at: string }[];
  can_extend: boolean;
  can_request_extension: boolean;
};

export const clientKeys = { detail: (id: string) => ["credits", "client", id] as const };

export async function fetchSalesClient(id: string): Promise<SalesClient> {
  const { data, error } = await createClient().rpc("fn_sales_client", { p_client_id: id });
  if (error) throw error;
  return data as SalesClient;
}

/** fn_extend_expiry: the sales manager applies at once; a rep's request becomes an approval. */
export async function extendExpiry(lotId: string, newExpiresAt: string, reason: string): Promise<{ ok: boolean; pending_approval?: string }> {
  const { data, error } = await createClient().rpc("fn_extend_expiry", { p_lot_id: lotId, p_new_expires_at: newExpiresAt, p_reason: reason });
  if (error) throw error;
  return data as { ok: boolean; pending_approval?: string };
}
