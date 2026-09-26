import type { Database } from "../database.types";
import type { MessageKey } from "@gymos/i18n";

export type LeadStatus = Database["public"]["Enums"]["lead_status"];
export type LostReason = Database["public"]["Enums"]["lost_reason"];
export type TouchType = Database["public"]["Enums"]["touch_type"];

/** Pipeline columns, in order (docs/03 §1). won/lost are outcomes, not columns. */
export const OPEN_STAGES = ["new", "contacted", "onboarded", "quoted"] as const satisfies readonly LeadStatus[];
export type OpenStage = (typeof OPEN_STAGES)[number];

export const LOST_REASONS = ["price", "location", "timing", "went_elsewhere", "no_response", "not_interested", "duplicate", "other"] as const satisfies readonly LostReason[];
export const SOURCES = ["walk_in", "instagram", "referral", "website", "event", "phone", "other"] as const;
export const INTERESTS = ["membership", "pt", "nutrition"] as const;
export const TOUCH_TYPES = ["call", "whatsapp", "visit", "email", "instagram", "note"] as const satisfies readonly TouchType[];

export const stageLabel = (s: LeadStatus) => `stage.${s}` as MessageKey;
export const lostReasonLabel = (r: LostReason) => `lost.${r}` as MessageKey;
export const sourceLabel = (s: string) => `source.${s}` as MessageKey;
export const interestLabel = (i: string) => `interest.${i}` as MessageKey;
export const touchLabel = (t: TouchType) => `touch.${t}` as MessageKey;

/** Stages a lead may move to from its current one: forward only, or lost (fn_set_lead_stage). */
export function allowedMoves(status: LeadStatus): (OpenStage | "lost")[] {
  const i = OPEN_STAGES.indexOf(status as OpenStage);
  if (i < 0) return [];
  return [...OPEN_STAGES.slice(i + 1), "lost"];
}
