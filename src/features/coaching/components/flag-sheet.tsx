"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { coachingErrorKey } from "@/features/sessions/errors";
import { t } from "@/lib/i18n";
import { useCoachingMutation } from "../hooks/use-coaching";
import { flagForSales } from "../queries/coaching";

/** Coach spots an upsell or a renewal: the client's rep (and the sales manager) get a FLAG task at once. */
export function FlagSheet({ clientId, name, onClose, onDone }: { clientId: string; name: string; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const flag = useCoachingMutation(() => flagForSales(clientId, note.trim()));
  return (
    <Sheet open onClose={onClose} title={t("coachClient.flagTitle", { name })} closeLabel={t("common.close")}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (note.trim()) flag.mutate(undefined, { onSuccess: onDone }); }}>
        <Field label={t("coachClient.flagNote")} htmlFor="flag-note" hint={t("coachClient.flagHint")}>
          <Textarea id="flag-note" className="font-sans" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {flag.isError ? <p role="alert" className="text-sm text-destructive">{t(coachingErrorKey(flag.error))}</p> : null}
        <Button type="submit" size="block" disabled={!note.trim() || flag.isPending}>{t("coachClient.flagSend")}</Button>
      </form>
    </Sheet>
  );
}
