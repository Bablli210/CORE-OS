import { createBrowserClient } from "@supabase/ssr";
import { configureClient, createClient } from "@gymos/api/supabase";
import type { Database } from "@gymos/api/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Supabase client for Client Components. Runs as the signed-in user; RLS applies. One instance per tab.
 * Registered with @gymos/api (M8), so the shared queries and hooks use this same cookie-session client.
 */
configureClient(() => createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey));

export { createClient };
