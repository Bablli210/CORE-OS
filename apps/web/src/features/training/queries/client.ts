import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import type { Program } from "@/features/programs/queries/programs";

export type Balance = { coach_membership_id: string; coach_name: string; balance: number; next_expiry: string };
export type ClientHome = {
  client_id: string;
  first_name: string;
  full_name: string;
  status: "active" | "frozen" | "lapsed";
  branch_id: string;
  branch_name: string;
  coach_name: string | null;
  balances: Balance[];
  membership_ends_at: string | null;
  checked_in_today: boolean;
  slots: { weekday: number; start_time: string; duration_minutes: number; coach_name: string }[];
  next_session: { starts_at: string; coach_name: string; branch_id: string; branch_name: string; within_hour: boolean } | null;
  program: { id: string; name: string; weeks: number; ends_at: string | null; coach_name: string | null; next_day_index: number | null; days: { day_index: number; name: string; exercises: number }[] } | null;
  workouts_this_week: number;
};
export type LastTime = { performed_at: string; sets: { set_index: number; weight_kg: number | null; reps: number | null; is_pr: boolean }[] | null; best_e1rm: number | null };
export type Training = { client_id: string; program: Program | null; next_day_index: number | null; history: Record<string, LastTime> };
export type Progress = {
  streak_weeks: number;
  workouts_30d: number;
  prs: { exercise_id: string; exercise_name: string; weight_kg: number; reps: number; e1rm: number; performed_at: string }[];
  exercise_id: string | null;
  series: { date: string; top_kg: number }[];
  body: { id: string; measured_at: string; weight_kg: number }[];
};
export type ClientCredits = {
  client_id: string;
  balances: Balance[];
  lots: { id: string; coach_name: string; qty_issued: number; qty_remaining: number; issued_at: string; expires_at: string; status: "active" | "exhausted" | "expired" | "refunded" }[];
  ledger: { id: string; entry_type: "issue" | "consume" | "expire" | "refund" | "adjust" | "restore"; qty: number; created_at: string; coach_name: string; session_at: string | null }[];
  payments: { id: string; amount_piastres: number; method: string; received_at: string; voided: boolean }[];
  memberships: { id: string; type: "membership" | "nutrition"; product_name: string | null; starts_at: string; ends_at: string; status: string }[];
  freezes: { id: string; starts_at: string; ends_at: string; days: number; status: "pending" | "active" | "ended" | "rejected" }[];
  freeze_max_days: number;
  advisor: { first_name: string; phone: string | null } | null;
  renewal_open: boolean;
};
export type SyncedSet = { id: string; set_index: number; weight_kg: number | null; reps: number | null; is_pr: boolean; exercise_id: string; exercises: { name: string } | null };
export type CheckInResult = { ok: boolean; reason?: "no_session_soon" | "bad_code" | "no_active_entitlement"; duplicate?: boolean; branch_name?: string; credit_balance?: number };

/** Every client-area query key starts with "client": a synced write refreshes them all. */
export const clientKeys = {
  all: ["client"] as const,
  home: ["client", "home"] as const,
  training: ["client", "training"] as const,
  progress: (exercise: string | null) => ["client", "progress", exercise ?? ""] as const,
  credits: ["client", "credits"] as const,
  workout: (id: string) => ["client", "workout", id] as const,
  profile: ["client", "profile"] as const,
};

const db = () => createClient();
function unwrap<T>({ data, error }: { data: unknown; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export const fetchHome = async (): Promise<ClientHome> => unwrap(await db().rpc("fn_client_home"));
export const fetchTraining = async (): Promise<Training> => unwrap(await db().rpc("fn_client_training"));
export const fetchProgress = async (exercise: string | null): Promise<Progress> => unwrap(await db().rpc("fn_client_progress", exercise ? { p_exercise: exercise } : {}));
export const fetchCredits = async (): Promise<ClientCredits> => unwrap(await db().rpc("fn_client_credits"));
export const fetchWorkoutSets = async (workoutId: string): Promise<SyncedSet[]> =>
  unwrap(await db().from("set_logs").select("id, set_index, weight_kg, reps, is_pr, exercise_id, exercises(name)").eq("workout_log_id", workoutId).order("exercise_id").order("set_index"));

export const requestRenewal = async (clientId: string, note: string) => unwrap(await db().rpc("fn_flag_for_sales", { p_client_id: clientId, p_note: note, p_kind: "renewal_request" }));
export const requestFreeze = async (clientId: string, startsAt: string, endsAt: string, reason: string) =>
  unwrap(await db().rpc("fn_request_freeze", { p_client_id: clientId, p_starts_at: startsAt, p_ends_at: endsAt, p_reason: reason }));
export const checkIn = async (branch?: string, code?: string): Promise<CheckInResult> =>
  unwrap(await db().rpc("fn_client_check_in", branch && code ? { p_branch: branch, p_code: code } : {}));
export const updateProfile = async (p: { pt_prefs?: { days?: string[]; time?: string; trainer_gender?: string }; instagram?: string; language?: "en" | "ar"; consent_marketing?: boolean; consent_content?: boolean }) =>
  unwrap(
    await db().rpc("fn_update_my_profile", {
      p_pt_prefs: p.pt_prefs as Json | undefined,
      p_instagram: p.instagram,
      p_language: p.language,
      p_consent_marketing: p.consent_marketing,
      p_consent_content: p.consent_content,
    }),
  );
