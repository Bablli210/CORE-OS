"use client";

import { Check, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProgramExercise } from "@gymos/api/programs/programs";
import { formatDate } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { cn } from "@/lib/utils";
import type { LastTime } from "@gymos/api/training/client";
import type { DraftExercise, DraftSet } from "@gymos/api/training/workout-draft";

/** One exercise: target, last time, and a row per set (kg, reps, Done). Inputs are prefilled from last time. */
export function ExerciseCard({
  exercise: e,
  draft,
  last,
  onChange,
  onSetDone,
}: {
  exercise: ProgramExercise;
  draft: DraftExercise;
  last: LastTime | undefined;
  onChange: (sets: DraftSet[]) => void;
  onSetDone: (restSeconds: number | null) => void;
}) {
  const set = (i: number, patch: Partial<DraftSet>) => onChange(draft.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const done = draft.sets.filter((s) => s.done).length;
  return (
    <details open={done < draft.sets.length} className="group rounded-lg border bg-card" data-testid="exercise-card">
      <summary className="flex min-h-tap cursor-pointer items-center justify-between gap-2 p-3">
        <span className="grid">
          <span className="font-medium">{e.superset_group ? <span className="me-1 rounded bg-muted px-1 text-xs">{e.superset_group}</span> : null}{e.exercise_name}</span>
          <span className="text-xs text-muted-foreground">
            {t("program.setsReps", { sets: e.sets, reps: e.reps })}{e.target_weight_kg ? ` · ${e.target_weight_kg} kg` : ""}{e.rest_seconds ? ` · ${t("program.restShort", { s: e.rest_seconds })}` : ""}
          </span>
        </span>
        <Badge variant={done === draft.sets.length ? "success" : "outline"}>{done}/{draft.sets.length}</Badge>
      </summary>
      <div className="grid gap-2 px-3 pb-3">
        {e.notes ? <p className="text-sm text-muted-foreground">{e.notes}</p> : null}
        <p className="text-xs text-muted-foreground" data-testid="last-time">
          {last?.sets?.length
            ? t("workout.lastTime", { date: formatDate(last.performed_at), sets: last.sets.map((s) => `${s.weight_kg ?? "–"}×${s.reps ?? "–"}`).join(", ") })
            : t("workout.firstTime")}
        </p>
        <div aria-hidden className="grid grid-cols-[2rem_1fr_1fr_2.75rem] gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>{t("workout.col.set")}</span>
          <span>{t("workout.col.kg")}</span>
          <span>{t("workout.col.reps")}</span>
          <span className="text-center">{t("workout.col.done")}</span>
        </div>
        <ol className="grid gap-2">
          {draft.sets.map((s, i) => (
            <li key={i} className="grid grid-cols-[2rem_1fr_1fr_2.75rem] items-center gap-2" data-testid="set-row">
              <span className="text-sm text-muted-foreground">{i + 1}</span>
              <Input aria-label={t("workout.kgFor", { n: i + 1, name: e.exercise_name })} inputMode="decimal" value={s.weight} placeholder="kg"
                onChange={(ev) => set(i, { weight: ev.target.value })} />
              <Input aria-label={t("workout.repsFor", { n: i + 1, name: e.exercise_name })} inputMode="numeric" value={s.reps} placeholder={t("program.reps")}
                onChange={(ev) => set(i, { reps: ev.target.value })} />
              <Button
                size="icon"
                variant={s.done ? "default" : "outline"}
                aria-pressed={s.done}
                aria-label={t("workout.doneFor", { n: i + 1, name: e.exercise_name })}
                className={cn(s.done && "bg-success text-success-foreground hover:bg-success/90")}
                onClick={() => {
                  set(i, { done: !s.done });
                  if (!s.done) onSetDone(e.rest_seconds);
                }}
              >
                <Check />
              </Button>
            </li>
          ))}
        </ol>
        <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => onChange([...draft.sets, { ...(draft.sets.at(-1) ?? { weight: "", reps: "" }), done: false }])}>
          <Plus aria-hidden />{t("workout.addSet")}
        </Button>
      </div>
    </details>
  );
}
