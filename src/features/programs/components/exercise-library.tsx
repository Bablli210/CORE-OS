"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { t } from "@/lib/i18n";
import { fetchMuscles, programKeys, searchExercises, type Exercise } from "../queries/programs";

/** Add an exercise from the library: search by name, filter by muscle group. Stays open to add several in a row. */
export function ExerciseLibrary({ dayName, onAdd, onClose }: { dayName: string; onAdd: (e: Exercise) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const search = useDeferredValue(query.trim());
  const muscles = useQuery({ queryKey: programKeys.muscles, queryFn: fetchMuscles, staleTime: 300_000 });
  const results = useQuery({ queryKey: programKeys.exercises(search, muscle), queryFn: () => searchExercises(search, muscle) });

  return (
    <Sheet open onClose={onClose} title={t("program.addTo", { day: dayName })} closeLabel={t("common.close")}>
      <div className="grid gap-3">
        <div className="grid gap-2 md:grid-cols-[1fr_12rem]">
          <label className="relative">
            <span className="sr-only">{t("program.searchLibrary")}</span>
            <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus type="search" className="ps-9" placeholder={t("program.searchLibrary")} value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label>
            <span className="sr-only">{t("program.muscle")}</span>
            <Select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
              <option value="">{t("program.allMuscles")}</option>
              {(muscles.data ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </label>
        </div>
        {results.isError ? <p role="alert" className="text-sm text-destructive">{t("error.retryHint")}</p> : null}
        {results.data?.length === 0 ? <p className="text-sm text-muted-foreground">{t("program.noExercise")}</p> : null}
        <ul className="grid max-h-[50dvh] gap-1 overflow-y-auto" aria-label={t("program.library")}>
          {(results.data ?? []).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
              <span className="grid">
                <span className="text-sm font-medium">{e.name}</span>
                <span className="text-xs text-muted-foreground">{[e.muscle_group, e.equipment].filter(Boolean).join(" · ")}</span>
              </span>
              <Button size="sm" variant={added.includes(e.id) ? "secondary" : "outline"} aria-label={t("program.addExercise", { name: e.name })} onClick={() => { onAdd(e); setAdded((a) => [...a, e.id]); }}>
                <Plus aria-hidden />{added.includes(e.id) ? t("program.added") : t("program.add")}
              </Button>
            </li>
          ))}
        </ul>
        <Button size="block" onClick={onClose}>{t("program.doneAdding")}</Button>
      </div>
    </Sheet>
  );
}
