"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import type { ProgramDay, ProgramExercise } from "../queries/programs";

const GROUPS = ["", "A", "B", "C", "D"];

/** One training day: its name and exercises (sets, reps, rest, target, superset group), reorder and remove. */
export function DayEditor({ day, onChange, onAdd }: { day: ProgramDay; onChange: (d: ProgramDay) => void; onAdd: () => void }) {
  const set = (i: number, patch: Partial<ProgramExercise>) => onChange({ ...day, exercises: day.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const move = (i: number, by: number) => {
    const next = [...day.exercises];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x);
    onChange({ ...day, exercises: next });
  };
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium">
        {t("program.dayName")}
        <Input value={day.name} onChange={(e) => onChange({ ...day, name: e.target.value })} />
      </label>
      {day.exercises.length === 0 ? <p className="text-sm text-muted-foreground">{t("program.emptyDay")}</p> : null}
      <ol className="grid gap-2">
        {day.exercises.map((e, i) => (
          <li key={`${e.exercise_id}-${i}`} data-testid="program-exercise" className="grid gap-2 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="grid">
                <span className="font-medium">{i + 1}. {e.exercise_name}</span>
                <span className="text-xs text-muted-foreground">{[e.muscle_group, e.equipment].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="flex">
                <Button size="icon" variant="ghost" aria-label={t("program.moveUp", { name: e.exercise_name })} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                <Button size="icon" variant="ghost" aria-label={t("program.moveDown", { name: e.exercise_name })} disabled={i === day.exercises.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                <Button size="icon" variant="ghost" aria-label={t("program.remove", { name: e.exercise_name })} onClick={() => onChange({ ...day, exercises: day.exercises.filter((_, j) => j !== i) })}><Trash2 /></Button>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
              <label className="grid gap-1 text-xs">{t("program.sets")}<Input type="number" min={1} inputMode="numeric" value={e.sets} onChange={(ev) => set(i, { sets: Math.max(1, Number(ev.target.value) || 1) })} /></label>
              <label className="grid gap-1 text-xs">{t("program.reps")}<Input value={e.reps} onChange={(ev) => set(i, { reps: ev.target.value })} /></label>
              <label className="grid gap-1 text-xs">{t("program.rest")}<Input type="number" min={0} step={15} inputMode="numeric" value={e.rest_seconds ?? ""} onChange={(ev) => set(i, { rest_seconds: ev.target.value === "" ? null : Number(ev.target.value) })} /></label>
              <label className="grid gap-1 text-xs">{t("program.target")}<Input type="number" min={0} step={0.5} inputMode="decimal" value={e.target_weight_kg ?? ""} onChange={(ev) => set(i, { target_weight_kg: ev.target.value === "" ? null : Number(ev.target.value) })} /></label>
              <label className="grid gap-1 text-xs">{t("program.tempo")}<Input value={e.tempo ?? ""} placeholder="3-1-1" onChange={(ev) => set(i, { tempo: ev.target.value || null })} /></label>
              <label className="grid gap-1 text-xs">{t("program.superset")}
                <Select value={e.superset_group ?? ""} onChange={(ev) => set(i, { superset_group: ev.target.value || null })}>
                  {GROUPS.map((g) => <option key={g} value={g}>{g || t("program.noSuperset")}</option>)}
                </Select>
              </label>
            </div>
            <Input aria-label={t("program.notesFor", { name: e.exercise_name })} placeholder={t("program.notes")} value={e.notes ?? ""} onChange={(ev) => set(i, { notes: ev.target.value || null })} />
          </li>
        ))}
      </ol>
      <Button variant="outline" onClick={onAdd}><Plus aria-hidden />{t("program.addFromLibrary")}</Button>
    </div>
  );
}
