import type { Database } from "@/lib/database.types";
import type { MessageKey } from "@/lib/i18n";

export type DealStatus = Database["public"]["Enums"]["deal_status"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type ProductType = Database["public"]["Enums"]["product_type"];
export type ApprovalType = Database["public"]["Enums"]["approval_type"];

export const PAYMENT_METHODS = ["cash", "card", "instapay", "bank_transfer", "other"] as const satisfies readonly PaymentMethod[];
export const PRODUCT_TYPES = ["membership", "pt_pack", "nutrition", "bundle"] as const satisfies readonly ProductType[];

export const dealStatusLabel = (s: DealStatus) => `deal.status.${s}` as MessageKey;
export const methodLabel = (m: string) => `payment.method.${m}` as MessageKey;
export const productTypeLabel = (t: string) => `product.type.${t}` as MessageKey;
export const approvalTypeLabel = (t: string) => `approval.type.${t}` as MessageKey;
export const approvalReasonLabel = (r: string) => `deal.reason.${r}` as MessageKey;
export const eventLabel = (type: string) => `deal.event.${type.replace(/\./g, "_")}` as MessageKey;

/** EGP typed by a person → piastres (the only unit the database accepts). Input conversion, not pricing. */
export function egpToPiastres(egp: string): number | null {
  const n = Number(egp.replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
