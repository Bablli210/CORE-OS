"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProgramDay } from "@/features/programs/queries/programs";
import { clearCacheKey, readCache, writeCache } from "../offline/cache";
import type { LastTime } from "../queries/client";
import { newDraft, type WorkoutDraft } from "../workout-draft";

const keyFor = (programId: string, dayIndex: number) => `draft:${programId}:${dayIndex}`;

/** The workout in progress for one program day, saved to IndexedDB on every change so a reload or a dead battery keeps it. */
export function useWorkoutDraft(programId: string | null, dayIndex: number, day: ProgramDay | undefined, history: Record<string, LastTime>) {
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const loaded = useRef<string | null>(null);

  useEffect(() => {
    if (!programId || !day) return;
    const key = keyFor(programId, dayIndex);
    if (loaded.current === key) return;
    loaded.current = key;
    void readCache<WorkoutDraft>(key).then((saved) => setDraft(saved ?? newDraft(programId, day, dayIndex, history)));
  }, [programId, dayIndex, day, history]);

  const update = useCallback(
    (fn: (d: WorkoutDraft) => WorkoutDraft) =>
      setDraft((d) => {
        if (!d) return d;
        const next = fn(d);
        void writeCache(keyFor(next.programId, next.dayIndex), next);
        return next;
      }),
    [],
  );

  const reset = useCallback(async () => {
    if (!programId || !day) return;
    await clearCacheKey(keyFor(programId, dayIndex));
    setDraft(newDraft(programId, day, dayIndex, history));
  }, [programId, dayIndex, day, history]);

  return { draft, update, reset };
}
