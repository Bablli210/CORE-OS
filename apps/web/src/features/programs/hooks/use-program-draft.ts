"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchProgram, fetchTemplates, programKeys, saveProgram, type Program, type ProgramDraft } from "../queries/programs";

const DEBOUNCE_MS = 400;

export const useProgram = (id: string | null) => useQuery({ queryKey: programKeys.program(id ?? ""), queryFn: () => fetchProgram(id!), enabled: !!id });
export const useTemplates = () => useQuery({ queryKey: programKeys.templates, queryFn: fetchTemplates, staleTime: 60_000 });

/**
 * The builder's working copy of a draft. Every change is saved to the database (fn_save_program) after a short pause, so the
 * route (?program=) plus the database is the whole state: a refresh or a dropped phone loses nothing. `flush()` saves now.
 */
export function useProgramDraft(program: Program | undefined) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ProgramDraft | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<unknown>(null);
  const loadedId = useRef<string | null>(null);
  const latest = useRef<ProgramDraft | null>(null);
  const timer = useRef<number | null>(null);
  const pending = useRef<Promise<void> | null>(null);

  // take the server copy once per program (later saves must not overwrite what the coach is typing)
  useEffect(() => {
    if (program && program.id !== loadedId.current) {
      loadedId.current = program.id;
      latest.current = { name: program.name, goal: program.goal, weeks: program.weeks, days: program.days };
      setDraft(latest.current);
      setState("idle");
    }
  }, [program]);

  const save = useCallback(async () => {
    if (!program || !latest.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setState("saving");
    const run = saveProgram(program.id, program.client_id, latest.current).then(
      (saved) => {
        queryClient.setQueryData(programKeys.program(saved.id), saved);
        setState("saved");
        setError(null);
      },
      (e: unknown) => {
        setState("error");
        setError(e);
      },
    );
    pending.current = run;
    await run;
  }, [program, queryClient]);

  const change = useCallback(
    (fn: (d: ProgramDraft) => ProgramDraft) => {
      if (!latest.current) return;
      latest.current = fn(latest.current);
      setDraft(latest.current);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void save(), DEBOUNCE_MS);
    },
    [save],
  );

  const flush = useCallback(async () => {
    if (timer.current) await save();
    else if (pending.current) await pending.current;
  }, [save]);

  // leaving the tab (phone locked, app switched): save what is there now
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && timer.current) void save();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [save]);

  return { draft, change, flush, state, error };
}
