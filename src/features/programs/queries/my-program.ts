import type { createClient } from "@/lib/supabase/server";
import type { Program } from "./programs";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** The signed-in client's active program (programs RLS: own rows), with days and exercises from fn_program. */
export async function fetchMyActiveProgram(supabase: ServerClient): Promise<Program | null> {
  const { data, error } = await supabase.from("programs").select("id").eq("status", "active").limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const res = await supabase.rpc("fn_program", { p_program: data.id });
  if (res.error) throw res.error;
  return res.data as unknown as Program;
}
