import type { ProgramDay, ProgramExercise } from "../programs/programs";
import type { SetRow, WorkoutRow } from "./offline/outbox";
import type { LastTime } from "./client";

/** A workout in progress, kept on the phone (IndexedDB) until Finish. Keyed by program exercise (id) in the day's order. */
export type DraftSet = { weight: string; reps: string; done: boolean };
export type DraftExercise = { programExerciseId: string | null; exerciseId: string; sets: DraftSet[] };
export type WorkoutDraft = { programId: string; dayIndex: number; dayId: string | null; startedAt: string; exercises: DraftExercise[] };

/** "6-8" → "6", "45s" → "", "12" → "12". */
export function firstReps(reps: string): string {
  if (/^\s*\d+\s*(s|sec)\b/i.test(reps)) return ""; // a time, not reps
  const m = /^\s*(\d+)/.exec(reps);
  return m ? m[1] : "";
}

/** Each set starts from last time's set (same position), else the program's target. */
function startSets(e: ProgramExercise, last: LastTime | undefined): DraftSet[] {
  const prev = last?.sets ?? [];
  return Array.from({ length: Math.max(1, e.sets) }, (_, i) => {
    const p = prev[i] ?? prev[prev.length - 1];
    return {
      weight: p?.weight_kg != null ? String(p.weight_kg) : e.target_weight_kg != null ? String(e.target_weight_kg) : "",
      reps: p?.reps != null ? String(p.reps) : firstReps(e.reps),
      done: false,
    };
  });
}

export function newDraft(programId: string, day: ProgramDay, dayIndex: number, history: Record<string, LastTime>, now = new Date()): WorkoutDraft {
  return {
    programId,
    dayIndex,
    dayId: day.id ?? null,
    startedAt: now.toISOString(),
    exercises: day.exercises.map((e) => ({
      programExerciseId: e.id ?? null,
      exerciseId: e.exercise_id,
      sets: startSets(e, history[e.exercise_id]),
    })),
  };
}

const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return s.trim() === "" || !Number.isFinite(n) ? null : n;
};

export const doneSets = (d: WorkoutDraft) => d.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

/**
 * Finish: the rows to write, with ids made here (the outbox's idempotency keys). Only sets marked done and with a weight
 * or reps are kept; set_index counts the kept sets of each exercise from 1.
 */
export function toRows(d: WorkoutDraft, clientId: string, makeId: () => string, now = new Date()): { workout: WorkoutRow; sets: SetRow[] } {
  const workout: WorkoutRow = {
    id: makeId(),
    client_id: clientId,
    program_day_id: d.dayId,
    performed_at: now.toISOString(),
    duration_minutes: Math.max(1, Math.round((now.getTime() - new Date(d.startedAt).getTime()) / 60_000)),
    notes: null,
  };
  const sets: SetRow[] = d.exercises.flatMap((e) =>
    e.sets
      .filter((s) => s.done && (num(s.weight) !== null || num(s.reps) !== null))
      .map((s, i) => ({
        id: makeId(),
        workout_log_id: workout.id,
        program_exercise_id: e.programExerciseId,
        exercise_id: e.exerciseId,
        set_index: i + 1,
        weight_kg: num(s.weight),
        reps: num(s.reps) === null ? null : Math.round(num(s.reps)!),
      })),
  );
  return { workout, sets };
}
