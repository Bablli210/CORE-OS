import type { PostgrestError } from "@supabase/supabase-js";
import type { MessageKey } from "@/lib/i18n";

/** RPC errors from deals / approvals / extensions → what to do next. */
export function dealErrorKey(error: unknown): MessageKey {
  const e = error as PostgrestError | null;
  const m = e?.message ?? "";
  if (e?.code === "42501") return "error.notAllowed";
  if (m.includes("PT pack must be recorded under")) return "deal.error.needsCoach";
  if (m.includes("installments are disabled")) return "deal.error.installmentsOff";
  if (m.includes("not a draft")) return "deal.error.notDraft";
  if (m.includes("paid deals need a refund")) return "deal.error.paidCancel";
  if (m.includes("request for this pack is already waiting")) return "transfer.error.pending";
  if (m.includes("request for this payment is already waiting")) return "refund.error.pending";
  if (m.includes("already waiting for approval")) return "payment.error.voidPending";
  if (m.includes("payment already voided")) return "refund.error.voided";
  if (m.includes("pick another client")) return "transfer.error.sameClient";
  if (m.includes("only an active pack")) return "transfer.error.inactive";
  if (m.includes("freeze exceeds")) return "credits.freeze.tooLong";
  if (m.includes("freeze limit")) return "credits.freeze.limit";
  if (m.includes("new expiry must be later")) return "credits.error.laterDate";
  if (m.includes("reason required")) return "credits.error.reason";
  if (m.includes("already decided")) return "approval.error.decided";
  if (m.includes("code already used")) return "product.error.code";
  if (e?.code === "23514" || e?.code === "P0001") return "deal.error.invalid";
  return "error.generic";
}
