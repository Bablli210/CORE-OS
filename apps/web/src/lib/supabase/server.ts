import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@gymos/api/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers. Runs as the signed-in user
 * (session from cookies); RLS applies. Never use the service role here (CLAUDE.md rule 2).
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only; middleware refreshes the session instead.
        }
      },
    },
  });
}
