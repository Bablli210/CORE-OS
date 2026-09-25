import { createClient } from "@/lib/supabase/client";

export type ProgramExercise = {
  exercise_id: string;
  exercise_name: string;
  muscle_group: string | null;
  equipment: string | null;
  sets: number;
  reps: string;
  tempo: string | null;
  rest_seconds: number | null;
  target_weight_kg: number | null;
  notes: string | null;
  superset_group: string | null;
};
export type ProgramDay = { id?: string; name: string; exercises: ProgramExercise[] };
export type ProgramStatus = "draft" | "active" | "archived";
export type Program = {
  id: string;
  client_id: string;
  client_name: string;
  coach_membership_id: string;
  coach_name: string | null;
  name: string;
  goal: string | null;
  weeks: number;
  status: ProgramStatus;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
  can_edit: boolean;
  days: ProgramDay[];
};
export type Template = { id: string; name: string; gym_wide: boolean; owner_name: string | null; days: ProgramDay[] };
export type Exercise = { id: string; name: string; muscle_group: string | null; equipment: string | null };
export type ProgramDraft = { name: string; goal: string | null; weeks: number; days: ProgramDay[] };

export const programKeys = {
  all: ["programs"] as const,
  program: (id: string) => ["programs", "program", id] as const,
  templates: ["programs", "templates"] as const,
  exercises: (search: string, muscle: string) => ["programs", "exercises", search, muscle] as const,
  muscles: ["programs", "muscles"] as const,
};

const db = () => createClient();
function unwrap<T>({ data, error }: { data: unknown; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

/** Only what fn_save_program stores; names/muscles are read back from the library. */
const toSave = (days: ProgramDay[]) =>
  days.map((d) => ({
    name: d.name,
    exercises: d.exercises.map((e) => ({
      exercise_id: e.exercise_id,
      sets: e.sets,
      reps: e.reps,
      tempo: e.tempo,
      rest_seconds: e.rest_seconds,
      target_weight_kg: e.target_weight_kg,
      notes: e.notes,
      superset_group: e.superset_group,
    })),
  }));

export const fetchProgram = async (id: string): Promise<Program> => unwrap(await db().rpc("fn_program", { p_program: id }));
export const fetchTemplates = async (): Promise<Template[]> => unwrap(await db().rpc("fn_program_templates"));
export const saveProgram = async (programId: string | null, clientId: string, d: ProgramDraft): Promise<Program> =>
  unwrap(
    await db().rpc("fn_save_program", {
      // null creates the draft (the generated type can't express a nullable argument without a default)
      p_program_id: programId as string,
      p_client_id: clientId,
      p_name: d.name,
      p_goal: d.goal as string,
      p_weeks: d.weeks,
      p_days: toSave(d.days),
    }),
  );
export const newVersion = async (programId: string): Promise<string> => unwrap(await db().rpc("fn_new_program_version", { p_program_id: programId }));
export const activateProgram = async (programId: string): Promise<Program> => unwrap(await db().rpc("fn_activate_program", { p_program_id: programId }));
export const saveTemplate = async (name: string, days: ProgramDay[], gymWide: boolean): Promise<string> =>
  unwrap(await db().rpc("fn_save_template", { p_name: name, p_days: toSave(days), p_gym_wide: gymWide }));

/** The exercise library is readable by every signed-in user (RLS); search by name, filter by muscle group. */
export async function searchExercises(search: string, muscle: string): Promise<Exercise[]> {
  let q = db().from("exercises").select("id, name, muscle_group, equipment").eq("is_active", true).order("name").limit(40);
  if (search) q = q.ilike("name", `%${search.replace(/[%_]/g, "")}%`);
  if (muscle) q = q.eq("muscle_group", muscle);
  return unwrap(await q);
}
export async function fetchMuscles(): Promise<string[]> {
  const rows = unwrap<{ muscle_group: string | null }[]>(await db().from("exercises").select("muscle_group").eq("is_active", true));
  return Array.from(new Set(rows.map((r) => r.muscle_group).filter((m): m is string => !!m))).sort();
}
