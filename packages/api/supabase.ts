import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * The one Supabase client every query in this package uses. Each app registers how to build it at startup:
 * the web with @supabase/ssr's browser client (cookie session), the phone with supabase-js and SecureStore/AsyncStorage.
 * It always runs as the signed-in user; RLS applies. One instance per app session.
 */
export type Db = SupabaseClient<Database>;

let factory: (() => Db) | null = null;
let instance: Db | null = null;

export function configureClient(make: () => Db): void {
  factory = make;
  instance = null;
}

export function createClient(): Db {
  if (!factory) throw new Error("@gymos/api: configureClient() was not called at app start");
  instance ??= factory();
  return instance;
}
