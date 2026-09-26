import { createClient } from "../supabase";

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

export type Freeze = { id: string; starts_at: string; ends_at: string; days: number; status: "pending" | "active" | "ended" | "rejected"; reason: string | null };
export type ClientRequests = {
  status: string;
  freezes: Freeze[];
  transfers: { id: string; lot_id: string; status: "pending" | "approved" | "rejected"; to_client_name: string; qty: number; requested_at: string }[];
  freeze_max_days: number;
  can_freeze: boolean;
  can_end_freeze: boolean;
  can_transfer: boolean;
};
export const requestKeys = { client: (id: string) => ["credits", "requests", id] as const };

/** Freezes and transfer requests for a client, with what the caller may do (fn_client_requests). */
export async function fetchClientRequests(id: string): Promise<ClientRequests> {
  const { data, error } = await createClient().rpc("fn_client_requests", { p_client_id: id });
  if (error) throw error;
  return data as ClientRequests;
}

/** fn_request_freeze on the client's behalf: becomes a freeze approval for the sales manager. */
export async function requestFreezeFor(clientId: string, startsAt: string, endsAt: string, reason: string): Promise<string> {
  const { data, error } = await createClient().rpc("fn_request_freeze", { p_client_id: clientId, p_starts_at: startsAt, p_ends_at: endsAt, p_reason: reason });
  if (error) throw error;
  return data as string;
}

/** fn_end_freeze now (sales manager): extends the packs and memberships by the frozen days. */
export async function endFreeze(freezeId: string): Promise<void> {
  const { error } = await createClient().rpc("fn_end_freeze", { p_freeze_id: freezeId });
  if (error) throw error;
}

/** fn_request_transfer: the pack's remaining sessions to another client, after the sales manager approves. */
export async function requestTransfer(lotId: string, toClientId: string, reason: string): Promise<string> {
  const { data, error } = await createClient().rpc("fn_request_transfer", { p_lot_id: lotId, p_to_client_id: toClientId, p_reason: reason });
  if (error) throw error;
  return data as string;
}

export type PhoneMatch = { found: boolean; kind?: "lead" | "client"; id?: string; visible?: boolean; name?: string | null; branch_code?: string };
/** Who has this phone (fn_find_by_phone): the transfer target is picked by phone, the way the front desk knows people. */
export async function findByPhone(phone: string): Promise<PhoneMatch> {
  const { data, error } = await createClient().rpc("fn_find_by_phone", { p_phone: phone });
  if (error) throw error;
  return data as PhoneMatch;
}
