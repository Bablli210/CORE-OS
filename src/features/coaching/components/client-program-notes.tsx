"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { coachingErrorKey } from "@/features/sessions/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { t, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCoachingMutation } from "../hooks/use-coaching";
import { addNote, type CoachClient, type NoteVisibility } from "../queries/coaching";

/** Program: current and past programs; open the builder on the draft, or start one. */
export function ProgramTab({ client: c }: { client: CoachClient }) {
  const draft = c.programs.find((p) => p.status === "draft");
  return (
    <div className="grid gap-3">
      <Link href={`/coach/clients/${c.id}/program${draft ? `?program=${draft.id}` : ""}`} className={cn(buttonVariants(), "w-full md:w-auto md:justify-self-start")}>
        {draft ? t("coachClient.continueDraft") : c.programs.length ? t("coachClient.newProgram") : t("coachClient.buildProgram")}
      </Link>
      {c.programs.length === 0 ? <p className="text-sm text-muted-foreground">{t("coachClient.noProgram")}</p> : null}
      <ul className="grid gap-2">
        {c.programs.map((p) => (
          <li key={p.id}>
            <Link href={`/coach/clients/${c.id}/program?program=${p.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm hover:bg-accent">
              <span className="grid">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">
                  {t("coachClient.programLine", { days: p.days, weeks: p.weeks })}
                  {p.starts_at ? ` · ${formatDate(p.starts_at)}${p.ends_at ? ` – ${formatDate(p.ends_at)}` : ""}` : ""}
                </span>
              </span>
              <Badge variant={p.status === "active" ? "success" : "outline"}>{t(`program.status.${p.status}` as MessageKey)}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Notes: coaching notes (visibility coaching / all; sales-only notes are not shown here). */
export function NotesTab({ client: c }: { client: CoachClient }) {
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<NoteVisibility>("coaching");
  const add = useCoachingMutation(() => addNote(c.id, body.trim(), visibility));
  return (
    <div className="grid gap-4">
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate(undefined, { onSuccess: () => setBody("") }); }}>
        <Field label={t("notes.new")} htmlFor="note-body">
          <Textarea id="note-body" className="font-sans" value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label={t("notes.visibility")} htmlFor="note-visibility">
          <Select id="note-visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as NoteVisibility)}>
            <option value="coaching">{t("notes.visibility.coaching")}</option>
            <option value="all">{t("notes.visibility.all")}</option>
          </Select>
        </Field>
        {add.isError ? <p role="alert" className="text-sm text-destructive">{t(coachingErrorKey(add.error))}</p> : null}
        <Button type="submit" className="w-full md:w-auto md:justify-self-start" disabled={!body.trim() || add.isPending}>{t("notes.add")}</Button>
      </form>
      {c.notes.length === 0 ? <p className="text-sm text-muted-foreground">{t("notes.empty")}</p> : null}
      <ul className="grid gap-2">
        {c.notes.map((n) => (
          <li key={n.id} className="grid gap-1 rounded-md border p-3 text-sm">
            <p className="whitespace-pre-wrap">{n.body}</p>
            <span className="text-xs text-muted-foreground">{[n.author, formatDateTime(n.created_at), t(`notes.visibility.${n.visibility}` as MessageKey)].join(" · ")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
