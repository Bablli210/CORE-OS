import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { LIVE_KEY } from "@/features/notifications/queries/notifications";
import type { LeadStatus } from "@/features/leads/labels";
import type { SlaState } from "@/features/leads/queries/leads";

type Fns = Database["public"]["Functions"];
export type TeamRow = Fns["fn_sales_team"]["Returns"][number];
export type RepMonth = Fns["fn_dashboard_reps"]["Returns"][number];
export type BreakdownRow = Fns["fn_lead_breakdown"]["Returns"][number];

export type Flag = { id: string; client_id: string; client_name: string; phone?: string; note: string; created_at: string; coach_name: string | null; assignee_name: string | null };
export type TodayFollowUp = { id: string; title: string; due_at: string; overdue: boolean; lead_id: string | null; client_id: string | null; name: string; phone: string };
export type Today = {
  flags: Flag[];
  follow_ups: TodayFollowUp[];
  new_leads: { id: string; full_name: string; phone: string; created_at: string; first_contact_due_at: string; sla_state: SlaState; source_name: string | null }[];
  onboarded_today: { id: string; full_name: string; phone: string; completed_at: string }[];
};
export type Queue = {
  flags: Flag[];
  unassigned: { id: string; full_name: string; phone: string; created_at: string; source_name: string | null; first_contact_due_at: string }[];
  review: { id: string; full_name: string; phone: string; created_at: string; owner_name: string | null; source_name: string | null }[];
  sla_breaches: { id: string; full_name: string; owner_name: string | null; first_contact_due_at: string }[];
  stale: { id: string; full_name: string; status: LeadStatus; owner_name: string | null; last_touch_at: string | null }[];
  approvals_pending: number;
};

export const salesKeys = {
  today: (branchId: string) => [...LIVE_KEY, "sales-today", branchId] as const,
  queue: (branchId: string) => [...LIVE_KEY, "sales-queue", branchId] as const,
  team: (branchId: string, month: string) => ["sales", "team", branchId, month] as const,
  numbers: (branchId: string, month: string) => ["sales", "numbers", branchId, month] as const,
};

function unwrap<T>({ data, error }: { data: unknown; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export async function fetchToday(branchId: string): Promise<Today> {
  return unwrap(await createClient().rpc("fn_sales_today", { p_branch_id: branchId }));
}
export async function fetchQueue(branchId: string): Promise<Queue> {
  return unwrap(await createClient().rpc("fn_sales_queue", { p_branch_id: branchId }));
}
export async function fetchTeam(branchId: string, month: string): Promise<TeamRow[]> {
  return unwrap(await createClient().rpc("fn_sales_team", { p_branch_id: branchId, p_month: month }));
}

export type Numbers = { breakdown: BreakdownRow[] };

/** Leads by source and lost reasons for the month: my leads (rep) or the branch (manager). The tiles are fn_dashboard_tiles. */
export async function fetchNumbers(branchId: string, month: string): Promise<Numbers> {
  return { breakdown: unwrap(await createClient().rpc("fn_lead_breakdown", { p_branch_id: branchId, p_month: month })) };
}
