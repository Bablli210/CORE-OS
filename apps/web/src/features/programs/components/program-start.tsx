"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { coachingErrorKey } from "@gymos/api/sessions/errors";
import { t } from "@gymos/i18n";
import { cn } from "@/lib/utils";
import { useTemplates } from "@/features/programs/hooks/use-program-draft";
import { saveProgram, type ProgramDay } from "@gymos/api/programs/programs";

/** First step: name and length, then start from a template (days and exercises filled in) or from a blank day. */
export function ProgramStart({ clientId, clientName, onCreated }: { clientId: string; clientName: string; onCreated: (programId: string) => void }) {
  const templates = useTemplates();
  const [name, setName] = useState(t("program.defaultName", { name: clientName.split(" ")[0] }));
  const [weeks, setWeeks] = useState(4);
  const [picked, setPicked] = useState<string>("");
  const create = useMutation({
    mutationFn: (days: ProgramDay[]) => saveProgram(null, clientId, { name: name.trim(), goal: null, weeks, days }),
    onSuccess: (p) => onCreated(p.id),
  });
  const template = templates.data?.find((x) => x.id === picked);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate(template ? template.days : [{ name: t("program.dayN", { n: 1 }), exercises: [] }]);
      }}
    >
      <div className="grid gap-3 md:grid-cols-[1fr_8rem]">
        <Field label={t("program.name")} htmlFor="program-name"><Input id="program-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t("program.weeks")} htmlFor="program-weeks"><Input id="program-weeks" type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Number(e.target.value) || 1)} /></Field>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t("program.startFrom")}</legend>
        <div role="radiogroup" className="grid gap-2 md:grid-cols-2">
          {[{ id: "", name: t("program.blank"), detail: t("program.blankDetail") }, ...(templates.data ?? []).map((x) => ({
            id: x.id,
            name: x.name,
            detail: t("program.templateDetail", { days: x.days.length, exercises: x.days.reduce((n, d) => n + d.exercises.length, 0), owner: x.gym_wide ? t("program.gymWide") : (x.owner_name ?? "") }),
          }))].map((o) => (
            <button
              key={o.id || "blank"}
              type="button"
              role="radio"
              aria-checked={picked === o.id}
              onClick={() => setPicked(o.id)}
              className={cn("grid gap-1 rounded-lg border p-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", picked === o.id ? "border-primary bg-primary/5" : "hover:bg-accent")}
            >
              <span className="font-medium">{o.name}</span>
              <span className="text-sm text-muted-foreground">{o.detail}</span>
            </button>
          ))}
        </div>
      </fieldset>
      {create.isError ? <p role="alert" className="text-sm text-destructive">{t(coachingErrorKey(create.error))}</p> : null}
      <Button type="submit" size="block" disabled={!name.trim() || create.isPending}>{t("program.create")}</Button>
    </form>
  );
}
