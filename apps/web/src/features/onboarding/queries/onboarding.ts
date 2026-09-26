import { createClient } from "@supabase/supabase-js";
import type { Database } from "@gymos/api/database.types";
import { publicEnv } from "@/lib/env";
import type { Answers, Responses } from "../steps";

/** The wizard is public: an anonymous client with no session, so a signed-in rep filling it together stays signed in. */
let anon: ReturnType<typeof createClient<Database>> | undefined;
const client = () => (anon ??= createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } }));

export type WizardState =
  | { ok: true; full_name: string; responses: Responses; completed: boolean; advisor: string; contact_by: string | null; branch_name: string; branch_phone: string | null; heard_from: string | null; instagram_handle: string | null }
  | { ok: false; reason: "invalid_or_expired" | "closed"; branch_phone?: string | null; branch_name?: string };

export type SubmitResult = { ok: true; advisor: string | null; contact_by: string | null } | { ok: false; reason: string };

export async function fetchWizardState(token: string): Promise<WizardState> {
  const { data, error } = await client().rpc("fn_onboarding_state", { p_token: token });
  if (error) throw error;
  return data as WizardState;
}

export async function submitStep(token: string, step: string, answers: Answers, complete: boolean): Promise<SubmitResult> {
  const { data, error } = await client().rpc("fn_submit_onboarding", { p_token: token, p_step: step, p_answers: answers, p_complete: complete });
  if (error) throw error;
  return data as SubmitResult;
}
