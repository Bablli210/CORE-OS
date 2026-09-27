import type { PostgrestError } from "@supabase/supabase-js";
import type { MessageKey } from "@gymos/i18n";

/** A failed fetch (no signal) rather than an answer from the database: worth retrying, never rolled back. */
export function isNetworkError(error: unknown): boolean {
  const e = error as (Partial<PostgrestError> & { name?: string }) | null;
  if (!e) return false;
  if (e.code) return false;
  const m = `${e.name ?? ""} ${e.message ?? ""}`;
  return /Failed to fetch|NetworkError|Load failed|network|fetch failed|timeout/i.test(m);
}

/** Schedule and attendance RPC errors → what to do next. The weekday prefix ("Sun: …") is kept by scheduleError(). */
export function coachingErrorKey(error: unknown): MessageKey {
  const e = error as PostgrestError | null;
  const m = e?.message ?? "";
  if (isNetworkError(error)) return "error.retryHint";
  if (e?.code === "42501") return "error.notAllowed";
  if (e?.code === "GY001" || m.includes("no credits with this coach")) return "schedule.error.noCredits";
  // shared hours (docs/06 #20): only a Blocked hour and the same client twice are refused
  if (m.includes("overlaps a blocked hour")) return "schedule.error.blocked";
  if (m.includes("blocked hour cannot overlap")) return "schedule.error.blockedOver";
  if (m.includes("client already has a slot at that time") || m.includes("client already has a session at that time")) return "schedule.error.clientBusy";
  if (m.includes("working hours overlap")) return "hours.error.overlap";
  if (m.includes("end after its start")) return "hours.error.order";
  if (m.includes("pick at least one day")) return "schedule.error.noDay";
  if (m.includes("client required")) return "schedule.error.client";
  if (m.includes("only booked sessions")) return "today.error.notBooked";
  if (m.includes("client has no coach")) return "today.error.noCoach";
  if (m.includes("only a draft")) return "program.error.notDraft";
  if (m.includes("at least one exercise")) return "program.error.empty";
  if (m.includes("program name required") || m.includes("template name required")) return "program.error.name";
  if (m.includes("note is empty")) return "notes.error.empty";
  if (m.includes("reassignment requires a reason")) return "team.error.reason";
  if (m.includes("coach is in another branch")) return "team.error.branch";
  return "error.generic";
}

/** The weekday the database named when one day of several failed ("Sun: overlaps a blocked hour on that day", DETAIL = 0). */
export function failedWeekday(error: unknown): number | null {
  const detail = (error as PostgrestError | null)?.details;
  const n = detail != null && /^\d$/.test(String(detail)) ? Number(detail) : null;
  return n;
}
