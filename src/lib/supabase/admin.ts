import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Service-role client for the Supabase Auth ADMIN API only (creating/inviting auth users).
 * Bypasses RLS, so: never read or write tables with it, and only call it after checking the caller's permission
 * with their own session. Listed as an exception in docs/03 §9. Server-only (the import above fails in the browser).
 */
export function createAdminAuthClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (server-only). Run `pnpm env:local`.");
  return createClient<Database>(publicEnv.supabaseUrl, key, { auth: { autoRefreshToken: false, persistSession: false } }).auth.admin;
}
