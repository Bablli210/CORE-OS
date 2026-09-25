import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

type Fns = Database["public"]["Functions"];
export type SlotKind = Database["public"]["Enums"]["slot_kind"];
export type SessionStatus = Database["public"]["Enums"]["session_status"];
export type Outcome = Exclude<SessionStatus, "booked">;
export type SchedulableClient = Fns["fn_schedulable_clients"]["Returns"][number];

export type Slot = {
  id: string;
  weekday: number;
  start_time: string;
  duration_minutes: number;
  kind: SlotKind;
  client_id: string | null;
  client_name: string | null;
  label: string | null;
  starts_on: string;
  ends_on: string | null;
  credits_left: number | null;
  skipped: string[];
};
export type WorkingHours = { weekday: number; start_time: string; end_time: string };
export type CoachWeek = {
  coach: { membership_id: string; name: string; branch_id: string };
  can_edit: boolean;
  week_start: string;
  today: string;
  slot_minutes: number;
  availability: WorkingHours[];
  slots: Slot[];
};

export type DaySession = {
  id: string;
  starts_at: string;
  duration_minutes: number;
  client_id: string;
  client_name: string;
  status: SessionStatus;
  credits_left: number;
  unpaid: boolean;
  waived: boolean;
  is_walk_in: boolean;
  credit_consumed: boolean;
  slot_id: string | null;
  injuries: string | null;
  at_risk: boolean;
  late: boolean;
  pending_approval: boolean;
};
export type DayBlock = { slot_id: string; kind: SlotKind; label: string | null; starts_at: string; duration_minutes: number };
export type CoachFollowUp = { id: string; title: string; due_at: string; client_id: string | null; client_name: string | null; overdue: boolean };
export type CoachDay = {
  date: string;
  today: string;
  coach: { membership_id: string; name: string; branch_id: string };
  can_record: boolean;
  /** Head coach / top management: edits after the window apply at once instead of going to approval. */
  can_edit_late: boolean;
  edit_window_hours: number;
  availability: { start_time: string; end_time: string }[];
  sessions: DaySession[];
  blocks: DayBlock[];
  follow_ups: CoachFollowUp[];
};
export type AttendanceResult = { ok: boolean; pending_approval?: string; credit_balance?: number };

export const coachKeys = {
  all: ["coach"] as const,
  week: (coach: string, start: string) => ["coach", "week", coach, start] as const,
  clients: (coach: string) => ["coach", "schedulable", coach] as const,
  // under "live" too: a notification (a new client, a flag) refreshes the day
  day: (coach: string, date: string) => ["live", "coach-day", coach, date] as const,
};

const db = () => createClient();
function unwrap<T>({ data, error }: { data: unknown; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export const fetchWeek = async (coach: string, start: string): Promise<CoachWeek> => unwrap(await db().rpc("fn_coach_week", { p_coach: coach, p_week_start: start }));
export const fetchSchedulable = async (coach: string): Promise<SchedulableClient[]> => unwrap(await db().rpc("fn_schedulable_clients", { p_coach: coach }));
export const fetchDay = async (coach: string, date: string): Promise<CoachDay> => unwrap(await db().rpc("fn_coach_today", { p_coach: coach, p_date: date }));

export type NewSlots = { coach: string; weekdays: number[]; start: string; kind: SlotKind; clientId?: string | null; label?: string | null; duration: number; startsOn: string };
export const addWeeklySlots = async (s: NewSlots): Promise<string[]> =>
  unwrap(
    await db().rpc("fn_add_weekly_slots", {
      p_coach: s.coach,
      p_weekdays: s.weekdays,
      p_start_time: s.start,
      p_kind: s.kind,
      p_client_id: s.clientId ?? undefined,
      p_label: s.label ?? undefined,
      p_duration: s.duration,
      p_starts_on: s.startsOn,
    }),
  );
export const changeSlot = async (coach: string, slot: Slot, change: { weekday: number; start: string; duration: number; label: string | null }) =>
  unwrap(
    await db().rpc("fn_upsert_schedule_slot", {
      p_coach_membership_id: coach,
      p_weekday: change.weekday,
      p_start_time: change.start,
      p_kind: slot.kind,
      p_client_id: slot.client_id ?? undefined,
      p_label: change.label ?? undefined,
      p_duration: change.duration,
      p_starts_on: slot.starts_on,
      p_ends_on: slot.ends_on ?? undefined,
      p_slot_id: slot.id,
    }),
  );
export const endSlot = async (slotId: string, endsOn: string) => unwrap(await db().rpc("fn_end_schedule_slot", { p_slot_id: slotId, p_ends_on: endsOn }));
export const skipSlot = async (slotId: string, date: string, reason: string) => unwrap(await db().rpc("fn_skip_slot", { p_slot_id: slotId, p_date: date, p_reason: reason || undefined }));
export const setAvailability = async (coach: string, hours: WorkingHours[]) => unwrap(await db().rpc("fn_set_availability", { p_coach: coach, p_hours: hours }));

export const recordAttendance = async (sessionId: string, outcome: Outcome): Promise<AttendanceResult> =>
  unwrap(await db().rpc("fn_record_attendance", { p_session_id: sessionId, p_outcome: outcome }));
export const startWalkIn = async (clientId: string): Promise<string> => unwrap(await db().rpc("fn_start_walkin_session", { p_client_id: clientId }));
export const addSession = async (clientId: string, coach: string, at: string): Promise<string> =>
  unwrap(await db().rpc("fn_add_session", { p_client_id: clientId, p_coach_membership_id: coach, p_scheduled_at: at }));
export const completeFollowUp = async (id: string) => unwrap(await db().rpc("fn_complete_follow_up", { p_follow_up_id: id }));
