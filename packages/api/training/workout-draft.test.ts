import { describe, expect, it } from "vitest";
import type { ProgramDay } from "../programs/programs";
import { doneSets, firstReps, newDraft, toRows } from "./workout-draft";

const day = {
  id: "day-1",
  name: "Day 1",
  exercises: [
    { id: "pe-1", exercise_id: "squat", exercise_name: "Back squat", muscle_group: null, equipment: null, sets: 3, reps: "6-8", tempo: null, rest_seconds: 120, target_weight_kg: 80, notes: null, superset_group: null },
    { id: "pe-2", exercise_id: "plank", exercise_name: "Plank", muscle_group: null, equipment: null, sets: 2, reps: "45s", tempo: null, rest_seconds: 60, target_weight_kg: null, notes: null, superset_group: null },
  ],
} as ProgramDay;

describe("workout draft", () => {
  it("reads the first number of a rep target", () => {
    expect(firstReps("6-8")).toBe("6");
    expect(firstReps("12")).toBe("12");
    expect(firstReps("45s")).toBe("");
  });

  it("starts from last time's sets, else the program's target", () => {
    const d = newDraft("p", day, 1, { squat: { performed_at: "x", best_e1rm: 100, sets: [{ set_index: 1, weight_kg: 85, reps: 6, is_pr: false }] } });
    expect(d.exercises[0].sets).toEqual([
      { weight: "85", reps: "6", done: false },
      { weight: "85", reps: "6", done: false },
      { weight: "85", reps: "6", done: false },
    ]);
    expect(d.exercises[1].sets[0]).toEqual({ weight: "", reps: "", done: false });
    const fresh = newDraft("p", day, 1, {});
    expect(fresh.exercises[0].sets[0]).toEqual({ weight: "80", reps: "6", done: false });
  });

  it("finishing keeps done sets only, with ids and set numbers per exercise", () => {
    const d = newDraft("p", day, 1, {}, new Date("2026-09-25T08:00:00Z"));
    d.exercises[0].sets[0].done = true;
    d.exercises[0].sets[2] = { weight: "90", reps: "5", done: true };
    d.exercises[1].sets[0] = { weight: "", reps: "", done: true }; // nothing entered: dropped
    let n = 0;
    const rows = toRows(d, "client-1", () => `id-${++n}`, new Date("2026-09-25T08:47:00Z"));
    expect(doneSets(d)).toBe(3);
    expect(rows.workout).toMatchObject({ id: "id-1", client_id: "client-1", program_day_id: "day-1", duration_minutes: 47 });
    expect(rows.sets).toEqual([
      { id: "id-2", workout_log_id: "id-1", program_exercise_id: "pe-1", exercise_id: "squat", set_index: 1, weight_kg: 80, reps: 6 },
      { id: "id-3", workout_log_id: "id-1", program_exercise_id: "pe-1", exercise_id: "squat", set_index: 2, weight_kg: 90, reps: 5 },
    ]);
  });
});
