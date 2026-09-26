import type { PostgrestError } from "@supabase/supabase-js";
import type { MessageKey } from "@gymos/i18n";

/** Maps an RPC error to a message that says what to do. */
export function salesErrorKey(error: unknown): MessageKey {
  const e = error as PostgrestError | null;
  if (e?.code === "42501") return "error.notAllowed";
  if (e?.message?.includes("reassignment requires a reason")) return "leads.error.reasonRequired";
  if (e?.message?.includes("lost reason required")) return "leads.error.lostReason";
  if (e?.message?.includes("stage can only move forward")) return "leads.error.forwardOnly";
  if (e?.message?.includes("lead is closed")) return "leads.error.closed";
  if (e?.message?.includes("no active sales reps")) return "leads.error.noReps";
  if (e?.code === "23514") return "leads.error.invalid";
  return "error.generic";
}
