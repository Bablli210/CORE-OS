import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import type { Database } from "@gymos/api/database.types";
import { configureClient, createClient } from "@gymos/api/supabase";
import { env } from "./env";

/**
 * The phone's Supabase client, registered with @gymos/api so every shared query runs through it (as the signed-in
 * user; RLS applies). The session persists in AsyncStorage; tokens refresh while the app is in the foreground.
 */
configureClient(() =>
  createSupabaseClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  }),
);

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") void createClient().auth.startAutoRefresh();
    else void createClient().auth.stopAutoRefresh();
  });
}

export { createClient };
