import type { Database, Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import type { LeadStatus, LostReason, TouchType } from "../labels";

type Fns = Database["public"]["Functions"];
export type LeadRow = Fns["fn_sales_leads"]["Returns"][number];
export type RepOption = Fns["fn_sales_reps"]["Returns"][number];

export type LeadDetail = {
  id: string;
  branch_id: string;
  branch_name: string;
  full_name: string;
  phone: string;
  email: string | null;
  status: LeadStatus;
  lost_reason: LostReason | null;
  lost_note: string | null;
  interest_tags: string[];
  source_code: string | null;
  source_name: string | null;
  owner_membership_id: string | null;
  owner_name: string | null;
  created_at: string;
  stage_since: string;
  first_contact_due_at: string | null;
  first_contact_at: string | null;
  sla_state: SlaState;
  review_status: string;
  instagram_handle: string | null;
  consent_marketing: boolean | null;
  consent_content: boolean | null;
  onboarding: { responses: Record<string, Record<string, Json>>; completed_at: string | null; link_sent: boolean; link_expires_at: string | null };
  converted_client_id: string | null;
  can_edit: boolean;
  can_manage: boolean;
  touches: { id: string; type: TouchType; direction: string; note: string | null; occurred_at: string; by_name: string | null }[];
  follow_ups: { id: string; title: string; due_at: string; status: "open" | "done" | "skipped"; completed_at: string | null; assignee_name: string | null }[];
  deals: { id: string; status: string; total_piastres: number; created_at: string }[];
};

export type SlaState = "met" | "late" | "due" | "breached" | "closed";
export type PhoneMatch =
  | { found: false }
  | { found: true; kind: "lead"; id: string; visible: boolean; name: string | null; status: LeadStatus; owner_name: string; branch_code: string }
  | { found: true; kind: "client"; id: string; visible: boolean; name: string | null; branch_code: string };
export type CreateLeadResult = { duplicate: boolean; lead_id?: string; client_id?: string };

export const leadKeys = {
  all: ["leads"] as const,
  list: (branchId: string, status?: string, search?: string) => ["leads", "list", branchId, status ?? "", search ?? ""] as const,
  detail: (id: string) => ["leads", "detail", id] as const,
  reps: (branchId: string) => ["leads", "reps", branchId] as const,
};

const db = () => createClient();
function unwrap<T>({ data, error }: { data: unknown; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export async function fetchLeads(branchId: string, status?: LeadStatus, search?: string): Promise<LeadRow[]> {
  return unwrap(await db().rpc("fn_sales_leads", { p_branch_id: branchId, p_status: status, p_search: search || undefined }));
}
export async function fetchLead(id: string): Promise<LeadDetail> {
  return unwrap(await db().rpc("fn_sales_lead", { p_lead_id: id }));
}
export async function findByPhone(phone: string): Promise<PhoneMatch> {
  return unwrap(await db().rpc("fn_find_by_phone", { p_phone: phone }));
}
export async function fetchReps(branchId: string): Promise<RepOption[]> {
  return unwrap(await db().rpc("fn_sales_reps", { p_branch_id: branchId }));
}

export async function createLead(input: { branchId: string; fullName: string; phone: string; source: string; interests: string[]; note?: string }): Promise<CreateLeadResult> {
  return unwrap(
    await db().rpc("fn_create_lead", {
      p_branch_id: input.branchId,
      p_full_name: input.fullName,
      p_phone: input.phone,
      p_source_code: input.source,
      p_interest_tags: input.interests,
      p_note: input.note || undefined,
    }),
  );
}
export async function issueOnboardingToken(leadId: string): Promise<string> {
  return unwrap(await db().rpc("fn_issue_onboarding_token", { p_lead_id: leadId }));
}
export async function setLeadStage(leadId: string, status: LeadStatus, lostReason?: LostReason, lostNote?: string): Promise<void> {
  unwrap(await db().rpc("fn_set_lead_stage", { p_lead_id: leadId, p_status: status, p_lost_reason: lostReason, p_lost_note: lostNote || undefined }));
}
export async function assignLead(leadId: string, membershipId: string | null, reason?: string): Promise<string> {
  return unwrap(await db().rpc("fn_assign_lead", { p_lead_id: leadId, p_membership_id: membershipId ?? undefined, p_reason: reason || undefined }));
}
export async function reviewLead(leadId: string, approve: boolean, note?: string): Promise<void> {
  unwrap(await db().rpc("fn_review_lead", { p_lead_id: leadId, p_approve: approve, p_note: note || undefined }));
}
export async function logTouch(input: { leadId?: string; clientId?: string; type: TouchType; direction?: "outbound" | "inbound"; note?: string }): Promise<string> {
  return unwrap(
    await db().rpc("fn_log_touch", {
      p_lead_id: input.leadId as string,
      p_client_id: input.clientId as string,
      p_type: input.type,
      p_direction: input.direction ?? "outbound",
      p_note: input.note || undefined,
    }),
  );
}
export async function addFollowUp(input: { leadId?: string; clientId?: string; title: string; dueAt: string }): Promise<string> {
  return unwrap(await db().rpc("fn_add_follow_up", { p_lead_id: input.leadId as string, p_client_id: input.clientId as string, p_title: input.title, p_due_at: input.dueAt }));
}
export async function completeFollowUp(id: string, status: "done" | "skipped" = "done"): Promise<void> {
  unwrap(await db().rpc("fn_complete_follow_up", { p_follow_up_id: id, p_status: status }));
}
export async function setRotationPaused(membershipId: string, paused: boolean): Promise<void> {
  unwrap(await db().rpc("fn_set_rotation_paused", { p_membership_id: membershipId, p_paused: paused }));
}
