"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { coachingErrorKey } from "@gymos/api/sessions/errors";
import { t } from "@gymos/i18n";
import { programKeys, saveTemplate, type ProgramDay } from "@gymos/api/programs/programs";

/** "Save as template": for me, or gym-wide (head coach). */
export function SaveTemplateSheet({ days, defaultName, canGymWide, onClose, onDone }: { days: ProgramDay[]; defaultName: string; canGymWide: boolean; onClose: () => void; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(defaultName);
  const [gymWide, setGymWide] = useState(false);
  const save = useMutation({ mutationFn: () => saveTemplate(name.trim(), days, gymWide), onSuccess: () => queryClient.invalidateQueries({ queryKey: programKeys.templates }) });
  return (
    <Sheet open onClose={onClose} title={t("program.saveTemplate")} closeLabel={t("common.close")}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined, { onSuccess: onDone }); }}>
        <Field label={t("program.templateName")} htmlFor="template-name"><Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        {canGymWide ? (
          <label className="flex items-center gap-3 text-sm"><Switch checked={gymWide} onCheckedChange={setGymWide} aria-label={t("program.gymWideToggle")} />{t("program.gymWideToggle")}</label>
        ) : null}
        {save.isError ? <p role="alert" className="text-sm text-destructive">{t(coachingErrorKey(save.error))}</p> : null}
        <Button type="submit" size="block" disabled={!name.trim() || save.isPending}>{t("common.save")}</Button>
      </form>
    </Sheet>
  );
}
