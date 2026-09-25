"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { cairoInstant, cairoToday, addDays } from "@/features/sessions/week";
import { t } from "@/lib/i18n";
import { clientKeys, requestFreeze, requestRenewal } from "../queries/client";

function errorText(e: unknown): string {
  const m = (e as { message?: string } | null)?.message ?? "";
  if (m.includes("freeze exceeds")) return t("credits.freeze.tooLong");
  if (m.includes("freeze limit")) return t("credits.freeze.limit");
  return t("error.retryHint");
}

/** Renew: tells the rep (FLAG task), the sales manager and the coach at once (fn_flag_for_sales, renewal_request). */
export function RenewSheet({ clientId, onClose, onDone }: { clientId: string; onClose: () => void; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const renew = useMutation({ mutationFn: () => requestRenewal(clientId, note.trim() || t("credits.renewDefault")), onSuccess: () => queryClient.invalidateQueries({ queryKey: clientKeys.all }) });
  return (
    <Sheet open onClose={onClose} title={t("credits.renew")} closeLabel={t("common.close")}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); renew.mutate(undefined, { onSuccess: onDone }); }}>
        <p className="text-sm">{t("credits.renewBody")}</p>
        <Field label={t("credits.renewNote")} htmlFor="renew-note"><Textarea id="renew-note" className="font-sans" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("credits.renewPlaceholder")} /></Field>
        {renew.isError ? <p role="alert" className="text-sm text-destructive">{errorText(renew.error)}</p> : null}
        <Button type="submit" size="block" disabled={renew.isPending}>{t("credits.renewSend")}</Button>
      </form>
    </Sheet>
  );
}

/** Request a freeze: goes to the sales manager for approval (fn_request_freeze). */
export function FreezeSheet({ clientId, maxDays, onClose, onDone }: { clientId: string; maxDays: number; onClose: () => void; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [start, setStart] = useState(addDays(cairoToday(), 1));
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  const freeze = useMutation({
    mutationFn: () => requestFreeze(clientId, cairoInstant(start, "00:00"), cairoInstant(addDays(start, days), "00:00"), reason.trim()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientKeys.all }),
  });
  return (
    <Sheet open onClose={onClose} title={t("credits.freeze.title")} closeLabel={t("common.close")}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (reason.trim()) freeze.mutate(undefined, { onSuccess: onDone }); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("credits.freeze.from")} htmlFor="freeze-from"><Input id="freeze-from" type="date" min={cairoToday()} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label={t("credits.freeze.days", { max: maxDays })} htmlFor="freeze-days"><Input id="freeze-days" type="number" min={1} max={maxDays} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} /></Field>
        </div>
        <Field label={t("common.reasonRequired")} htmlFor="freeze-reason"><Textarea id="freeze-reason" className="font-sans" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <p className="text-sm text-muted-foreground">{t("credits.freeze.hint")}</p>
        {freeze.isError ? <p role="alert" className="text-sm text-destructive">{errorText(freeze.error)}</p> : null}
        <Button type="submit" size="block" disabled={!reason.trim() || !start || freeze.isPending}>{t("credits.freeze.send")}</Button>
      </form>
    </Sheet>
  );
}
