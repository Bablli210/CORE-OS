"use client";

import { CloudOff, Dumbbell } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { EmptyState, ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useTraining } from "../hooks/use-client";
import { useOutbox } from "../hooks/use-outbox";
import { useWorkoutDraft } from "../hooks/use-workout-draft";
import { doneSets, toRows } from "../workout-draft";
import { ExerciseCard } from "./exercise-card";
import { RestTimer } from "./rest-timer";
import { WorkoutSummary } from "./workout-summary";

/**
 * /c/workout — log today's workout fast (docs/04). Works without signal: the program comes from the phone's copy, the
 * workout in progress lives in IndexedDB, and Finish queues it in the outbox (sent now, or when signal returns).
 * URL: ?day= (program day), ?done= (the summary of the workout just finished).
 */
export function WorkoutScreen() {
  const params = useSearchParams();
  const pathname = usePathname();
  const training = useTraining();
  const { push, online } = useOutbox();
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const data = training.data;
  const program = data?.program ?? null;
  const days = program?.days ?? [];
  const dayIndex = Math.min(Math.max(1, Number(params.get("day") ?? data?.next_day_index ?? 1)), Math.max(1, days.length));
  const day = days[dayIndex - 1];
  const { draft, update, reset } = useWorkoutDraft(program?.id ?? null, dayIndex, day, data?.history ?? {});
  const doneId = params.get("done");
  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    // history.replaceState (synced into useSearchParams by Next) needs no server round trip, so it works without signal
    window.history.replaceState(null, "", `${pathname}${next.size ? `?${next}` : ""}`);
  };
  const stopRest = useCallback(() => setRestUntil(null), []);

  if (doneId) return <><PageHeader title={t("workout.title")} /><WorkoutSummary workoutId={doneId} onAnother={() => go({ done: null })} /></>;
  if (training.isPending) return <LoadingList label={t("common.loading")} />;
  if (training.isError || !data) return <ErrorState title={t("workout.error")} body={t("workout.errorBody")} action={<Button variant="outline" onClick={() => training.refetch()}>{t("common.retry")}</Button>} />;
  if (!program || days.length === 0) {
    return <><PageHeader title={t("workout.title")} /><EmptyState icon={Dumbbell} title={t("myProgram.none")} body={t("myProgram.noneBody")} action={{ href: "/c", label: t("nav.backToday") }} /></>;
  }

  const finish = async () => {
    if (!draft) return;
    setSaving(true);
    const rows = toRows(draft, data.client_id, () => crypto.randomUUID());
    await push({ key: rows.workout.id, kind: "workout", createdAt: rows.workout.performed_at, workout: rows.workout, sets: rows.sets });
    await reset();
    setSaving(false);
    setRestUntil(null);
    go({ done: rows.workout.id });
  };
  const count = draft ? doneSets(draft) : 0;

  return (
    <div className="grid gap-4 pb-48 md:pb-4">
      <PageHeader title={t("workout.title")} description={program.name} />
      {!online || data.fromCache ? (
        <p role="status" className="flex items-center gap-2 rounded-md border border-warning bg-warning/10 p-2 text-sm"><CloudOff aria-hidden className="size-4" />{t("workout.offline")}</p>
      ) : null}
      <div role="tablist" aria-label={t("program.days")} className="flex gap-1 overflow-x-auto">
        {days.map((d, i) => (
          <button key={d.id ?? i} type="button" role="tab" aria-selected={i + 1 === dayIndex} onClick={() => go({ day: String(i + 1) })}
            className={cn("min-h-tap whitespace-nowrap rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", i + 1 === dayIndex ? "bg-primary text-primary-foreground" : "bg-muted")}>
            {d.name}{i + 1 === data.next_day_index ? ` · ${t("workout.next")}` : ""}
          </button>
        ))}
      </div>
      {draft && day ? (
        <div className="grid gap-2">
          {day.exercises.map((e, i) => (
            <ExerciseCard key={`${e.id ?? e.exercise_id}-${i}`} exercise={e} draft={draft.exercises[i]} last={data.history[e.exercise_id]}
              onChange={(sets) => update((d) => ({ ...d, exercises: d.exercises.map((x, j) => (j === i ? { ...x, sets } : x)) }))}
              onSetDone={(rest) => setRestUntil(rest ? Date.now() + rest * 1000 : null)} />
          ))}
        </div>
      ) : <LoadingList label={t("common.loading")} rows={3} />}
      <div className="fixed inset-x-0 bottom-16 z-20 grid gap-2 border-t bg-background p-3 md:sticky md:bottom-4 md:border-0 md:bg-transparent md:p-0">
        {restUntil ? <RestTimer until={restUntil} onDone={stopRest} onAdd={(s) => setRestUntil((u) => (u ?? Date.now()) + s * 1000)} /> : null}
        <Button size="block" disabled={count === 0 || saving} onClick={() => void finish()}>{t("workout.finish", { n: count })}</Button>
      </div>
    </div>
  );
}
