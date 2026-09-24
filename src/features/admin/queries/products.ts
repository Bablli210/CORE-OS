import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

export type Product = Database["public"]["Tables"]["products"]["Row"] & { bundle_items: { product_id: string; qty: number }[] };
/** A product being edited in the form: every field optional, id null for a new product or a new branch price. */
export type ProductDraft = Omit<Partial<Product>, "id"> & { id: string | null };

export type ProductInput = {
  id: string | null;
  code: string;
  name: string;
  type: Database["public"]["Enums"]["product_type"];
  branchId: string | null;
  pricePiastres: number;
  durationDays: number | null;
  sessionCount: number | null;
  expiryDays: number | null;
  sessionMinutes: number;
  isActive: boolean;
  sortOrder: number;
  bundleItems: { product_id: string; qty: number }[];
};

export const productKeys = { all: ["products"] as const };

/** The catalog (RLS: every signed-in staff member may read it). */
export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await createClient().from("products").select("*, bundle_items!bundle_items_bundle_product_id_fkey(product_id, qty)").order("sort_order").order("code");
  if (error) throw error;
  return data as Product[];
}

export async function saveProduct(p: ProductInput): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_save_product", {
    p_id: p.id as string,
    p_code: p.code,
    p_name: p.name,
    p_type: p.type,
    p_branch_id: p.branchId as string,
    p_price_piastres: p.pricePiastres,
    p_duration_days: p.durationDays as number,
    p_session_count: p.sessionCount as number,
    p_expiry_days: p.expiryDays as number,
    p_session_minutes: p.sessionMinutes,
    p_is_active: p.isActive,
    p_sort_order: p.sortOrder,
  });
  if (error) throw error;
  if (p.type === "bundle") {
    const r = await supabase.rpc("fn_save_bundle_items", { p_bundle_id: data, p_items: p.bundleItems });
    if (r.error) throw r.error;
  }
  return data;
}
