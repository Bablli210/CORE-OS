"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/features/auth/me-context";
import { useCoachClient } from "@/features/coaching/hooks/use-coaching";
import { coachingErrorKey } from "@/features/sessions/errors";
import { t, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useProgram, useProgramDraft } from "../hooks/use-program-draft";
import { activateProgram, newVersion, programKeys } from "../queries/programs";
import { DayEditor } from "./day-editor";
import { ExerciseLibrary } from "./exercise-library";
import { ProgramPreview } from "./program-preview";
import { ProgramStart } from "./program-start";
import { SaveTemplateSheet } from "./save-template-sheet";

/**
 * /coach/clients/[id]/program — the builder. The route is the state: ?program= (the draft, saved as you type), ?day= (the day
 * being edited), ?view=preview, ?add=1 (the library open). A refresh lands exactly where the coach was.
 */
export function ProgramBuilder({ clientId }: { clientId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const queryClient = useQueryClient();
  const programId = params.get("program");
  const client = useCoachClient(clientId);
  const program = useProgram(programId);
  const { draft, change, flush, state, error } = useProgramDraft(program.data?.status === "draft" ? program.data : undefined);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const edit = useMutation({ mutationFn: () => newVersion(programId!), onSuccess: (id) => go({ program: id, view: null }) });
  const activate = useMutation({
    mutationFn: async () => { await flush(); return activateProgram(programId!); },
    onSuccess: (p) => {
      queryClient.setQueryData(programKeys.program(p.id), p);
      void queryClient.invalidateQueries({ queryKey: ["coaching"] });
      setNotice(t("program.activated", { name: p.client_name }));
    },
  });

  // opening the builder without ?program= continues the client's draft if there is one
  const existingDraft = client.data?.programs.find((p) => p.status === "draft");
  useEffect(() => {
    if (!programId && existingDraft) go({ program: existingDraft.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, existingDraft?.id]);

  const title = <PageHeader title={t("program.title", { name: client.data?.full_name ?? program.data?.client_name ?? "" })} description={t("program.description")} actions={<Link href={`/coach/clients/${clientId}?tab=program`} className="text-sm underline underline-offset-4">{t("program.backToClient")}</Link>} />;

  if (!programId) {
    if (client.isPending) return <LoadingList label={t("common.loading")} />;
    if (client.isError || !client.data) return <ErrorState title={t("client.error.load")} body={t("coachClient.errorBody")} />;
    return <>{title}<ProgramStart clientId={clientId} clientName={client.data.full_name} onCreated={(id) => go({ program: id, day: "1" })} /></>;
  }
  if (program.isPending) return <LoadingList label={t("common.loading")} />;
  if (program.isError || !program.data) return <>{title}<ErrorState title={t("program.error.load")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => program.refetch()}>{t("common.retry")}</Button>} /></>;

  const p = program.data;
  const readOnly = p.status !== "draft" || !p.can_edit || !draft;
  const days = readOnly ? p.days : draft.days;
  const dayIndex = Math.min(Math.max(1, Number(params.get("day") ?? 1)), Math.max(1, days.length)) - 1;
  const day = days[dayIndex];
  const preview = readOnly || params.get("view") === "preview";

  return (
    <div className="grid gap-4 pb-24 md:pb-0">
      {title}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={p.status === "active" ? "success" : "outline"} data-testid="program-status">{t(`program.status.${p.status}` as MessageKey)}</Badge>
        {!readOnly ? <span role="status" className="text-sm text-muted-foreground" data-testid="save-state">{state === "saving" ? t("program.saving") : state === "saved" ? t("program.saved") : state === "error" ? t(coachingErrorKey(error)) : ""}</span> : null}
        {notice ? <span role="status" className="text-sm text-success">{notice}</span> : null}
      </div>

      {readOnly ? (
        <>
          <ProgramPreview days={p.days} />
          {p.status !== "draft" ? (
            <Button className="w-full md:w-auto md:justify-self-start" variant="outline" disabled={edit.isPending} onClick={() => edit.mutate()}>{t("program.editCopy")}</Button>
          ) : null}
          {edit.isError ? <p role="alert" className="text-sm text-destructive">{t(coachingErrorKey(edit.error))}</p> : null}
        </>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-[1fr_8rem]">
            <label className="grid gap-1 text-sm font-medium">{t("program.name")}<Input value={draft.name} onChange={(e) => change((d) => ({ ...d, name: e.target.value }))} /></label>
            <label className="grid gap-1 text-sm font-medium">{t("program.weeks")}<Input type="number" min={1} max={52} value={draft.weeks} onChange={(e) => change((d) => ({ ...d, weeks: Math.max(1, Number(e.target.value) || 1) }))} /></label>
          </div>
          <div role="tablist" aria-label={t("program.days")} className="flex flex-wrap items-center gap-1">
            {days.map((d, i) => (
              <button key={i} type="button" role="tab" aria-selected={!preview && i === dayIndex} onClick={() => go({ day: String(i + 1), view: null })}
                className={cn("min-h-tap rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", !preview && i === dayIndex ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {d.name || t("program.dayN", { n: i + 1 })}
              </button>
            ))}
            <button type="button" role="tab" aria-selected={preview} onClick={() => go({ view: "preview" })}
              className={cn("min-h-tap rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", preview ? "bg-primary text-primary-foreground" : "bg-muted")}>{t("program.preview")}</button>
            <Button size="sm" variant="ghost" disabled={days.length >= 7} onClick={() => { change((d) => ({ ...d, days: [...d.days, { name: t("program.dayN", { n: d.days.length + 1 }), exercises: [] }] })); go({ day: String(days.length + 1), view: null }); }}>
              <Plus aria-hidden />{t("program.addDay")}
            </Button>
          </div>

          {preview ? <ProgramPreview days={days} /> : day ? (
            <>
              <DayEditor day={day} onChange={(nd) => change((d) => ({ ...d, days: d.days.map((x, i) => (i === dayIndex ? nd : x)) }))} onAdd={() => go({ add: "1" })} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" disabled={days.length >= 7} onClick={() => { change((d) => ({ ...d, days: [...d.days, { ...day, name: t("program.copyOf", { name: day.name }) }] })); go({ day: String(days.length + 1) }); }}><Copy aria-hidden />{t("program.copyDay")}</Button>
                <Button size="sm" variant="ghost" disabled={days.length <= 1} onClick={() => { change((d) => ({ ...d, days: d.days.filter((_, i) => i !== dayIndex) })); go({ day: String(Math.max(1, dayIndex)) }); }}><Trash2 aria-hidden />{t("program.removeDay")}</Button>
              </div>
            </>
          ) : null}

          <div className="fixed inset-x-0 bottom-16 z-20 grid grid-cols-[1fr_auto] gap-2 border-t bg-background p-3 md:static md:flex md:border-0 md:bg-transparent md:p-0">
            <Button size="block" className="md:w-auto" disabled={activate.isPending || state === "saving"} onClick={() => activate.mutate()}>{t("program.activate")}</Button>
            <Button variant="outline" onClick={() => setTemplateOpen(true)}>{t("program.saveTemplate")}</Button>
          </div>
          {activate.isError ? <p role="alert" className="text-sm text-destructive">{t(coachingErrorKey(activate.error))}</p> : null}
        </>
      )}

      {params.get("add") && !readOnly && day ? (
        <ExerciseLibrary
          dayName={day.name}
          onClose={() => go({ add: null })}
          onAdd={(e) => change((d) => ({ ...d, days: d.days.map((x, i) => (i === dayIndex ? { ...x, exercises: [...x.exercises, { exercise_id: e.id, exercise_name: e.name, muscle_group: e.muscle_group, equipment: e.equipment, sets: 3, reps: "10", tempo: null, rest_seconds: 90, target_weight_kg: null, notes: null, superset_group: null }] } : x)) }))}
        />
      ) : null}
      {templateOpen && draft ? (
        <SaveTemplateSheet days={draft.days} defaultName={draft.name} canGymWide={me.memberships.some((m) => m.role === "head_coach" || m.role === "top_management")} onClose={() => setTemplateOpen(false)} onDone={() => { setTemplateOpen(false); setNotice(t("program.templateSaved")); }} />
      ) : null}
    </div>
  );
}
