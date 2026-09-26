import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import type { SessionStatus } from "@/features/sessions/queries/coach";

type Fns = Database["public"]["Functions"];
export type CoachClientRow = Fns["fn_coach_clients"]["Returns"][number];
export type AdherenceRow = Fns["fn_dashboard_adherence"]["Returns"][number];
export type HeatmapRow = Fns["fn_dashboard_heatmap"]["Returns"][number];
export type RankedCoach = Fns["fn_rank_coaches"]["Returns"][number];
export type NoteVisibility = Database["public"]["Enums"]["note_visibility"];

export type CoachClient = {
  id: string;
  full_name: string;
  phone: string;
  gender: string | null;
  status: "active" | "frozen" | "lapsed";
  joined_at: string;
  last_visit_at: string | null;
  branch_id: string;
  branch_name: string;
  coach_membership_id: string | null;
  coach_name: string | null;
  rep_name: string | null;
  risk_score: number;
  at_risk: boolean;
  risk_reasons: string[];
  injuries: string | null;
  onboarding: Record<string, Record<string, unknown> | undefined>;
  unpaid_sessions: number;
  balances: { coach_membership_id: string; coach_name: string; balance: number; next_expiry: string }[];
  membership_ends_at: string | null;
  adherence: { scheduled_30d: number; completed_30d: number; no_shows_30d: number; adherence_pct: number | null };
  slots: { id: string; weekday: number; start_time: string; duration_minutes: number; coach_membership_id: string; coach_name: string }[];
  next_session: { id: string; starts_at: string; coach_name: string } | null;
  sessions: { id: string; starts_at: string; status: SessionStatus; unpaid: boolean; settled_at: string | null; waived: boolean; is_walk_in: boolean; credit_consumed: boolean; coach_membership_id: string; coach_name: string }[];
  programs: { id: string; name: string; status: "draft" | "active" | "archived"; weeks: number; starts_at: string | null; ends_at: string | null; updated_at: string; days: number }[];
  workouts: { id: string; performed_at: string; day_name: string | null; sets: number; prs: number }[];
  notes: { id: string; body: string; visibility: NoteVisibility; created_at: string; author: string }[];
};

export type Team = {
  coaches: {
    membership_id: string;
    name: string;
    is_head_coach: boolean;
    capacity: number;
    active_clients: number;
    weekly_slots: number;
    sessions_completed: number;
    credits_burned: number;
    no_show_pct: number;
    revenue_delivered_net: number;
    commission_pct: number;
    unpaid_sessions: number;
    retention_pct: number | null;
    utilization_pct: number | null;
  }[];
  clients: { id: string; full_name: string; coach_membership_id: string; coach_name: string | null; credits_left: number }[];
  pending_edits: { approval_id: string; session_id: string; client_name: string; coach_name: string; starts_at: string; current_status: SessionStatus; requested_outcome: SessionStatus; waive: boolean; waive_reason: string | null; requested_by: string; requested_at: string }[];
  waivers: { session_id: string; client_name: string; coach_name: string; starts_at: string; reason: string | null; recorded_by: string | null }[];
  late_edits: { approval_id: string; client_name: string; starts_at: string; outcome: SessionStatus; status: "approved" | "rejected"; requested_by: string; decided_by: string | null; decided_at: string }[];
  unpaid: { session_id: string; client_name: string; coach_name: string; starts_at: string }[];
};

export const coachingKeys = {
  all: ["coaching"] as const,
  clients: (coach: string) => ["coaching", "clients", coach] as const,
  client: (id: string) => ["coaching", "client", id] as const,
  team: (branch: string, month: string) => ["coaching", "team", branch, month] as const,
  ranked: (client: string) => ["coaching", "ranked", client] as const,
  heatmap: ["coaching", "heatmap"] as const,
  adherence: ["coaching", "adherence"] as const,
};

const db = () => createClient();
function unwrap<T>({ data, error }: { data: unknown; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export const fetchCoachClients = async (coach: string): Promise<CoachClientRow[]> => unwrap(await db().rpc("fn_coach_clients", { p_coach: coach }));
export const fetchCoachClient = async (id: string): Promise<CoachClient> => unwrap(await db().rpc("fn_coach_client", { p_client: id }));
export const fetchTeam = async (branch: string, month: string): Promise<Team> => unwrap(await db().rpc("fn_coach_team", { p_branch: branch, p_month: month }));
export const fetchRanked = async (client: string): Promise<RankedCoach[]> => unwrap(await db().rpc("fn_rank_coaches", { p_client_id: client }));
export const fetchHeatmap = async (): Promise<HeatmapRow[]> => unwrap(await db().rpc("fn_dashboard_heatmap"));
export const fetchBranchAdherence = async (): Promise<AdherenceRow[]> => unwrap(await db().rpc("fn_dashboard_adherence", {}));

export const addNote = async (client: string, body: string, visibility: NoteVisibility) =>
  unwrap(await db().rpc("fn_add_client_note", { p_client: client, p_body: body, p_visibility: visibility }));
export const flagForSales = async (client: string, note: string) => unwrap(await db().rpc("fn_flag_for_sales", { p_client_id: client, p_note: note, p_kind: "upsell" }));
export const assignCoach = async (client: string, coach: string, reason: string) =>
  unwrap(await db().rpc("fn_assign_coach", { p_client_id: client, p_coach_membership_id: coach, p_reason: reason }));
export const decideApproval = async (id: string, approve: boolean, note?: string) =>
  unwrap(await db().rpc("fn_decide_approval", { p_approval_id: id, p_approve: approve, p_note: note || undefined }));
