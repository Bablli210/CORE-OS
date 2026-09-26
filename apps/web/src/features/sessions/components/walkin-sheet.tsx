"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { t } from "@gymos/i18n";
import { coachingErrorKey } from "@gymos/api/sessions/errors";
import { useCoachMutation, useSchedulable } from "../hooks/use-coach";
import { startWalkIn } from "@gymos/api/sessions/coach";

/** A client turns up outside their slot: record a completed session now (fn_start_walkin_session; same credit rules). */
export function WalkInSheet({ coach, onClose, onDone }: { coach: string; onClose: () => void; onDone: (name: string) => void }) {
  const clients = useSchedulable(coach);
  const [clientId, setClientId] = useState("");
  const client = clients.data?.find((c) => c.client_id === clientId);
  const start = useCoachMutation(() => startWalkIn(clientId));
  return (
    <Sheet open onClose={onClose} title={t("today.walkInTitle")} closeLabel={t("common.close")}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (client) start.mutate(undefined, { onSuccess: () => onDone(client.full_name) }); }}>
        <Field label={t("schedule.client")} htmlFor="walkin-client" hint={client && client.credits_left <= 0 ? t("today.unpaidWarning") : t("today.walkInHint")}>
          <Select id="walkin-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">{t("schedule.pickClient")}</option>
            {(clients.data ?? []).map((c) => (
              <option key={c.client_id} value={c.client_id}>{t("schedule.clientOption", { name: c.full_name, n: c.credits_left })}</option>
            ))}
          </Select>
        </Field>
        {start.isError ? <p role="alert" className="text-sm text-destructive">{t(coachingErrorKey(start.error))}</p> : null}
        <Button type="submit" size="block" disabled={!client || start.isPending}>{t("today.walkInStart")}</Button>
      </form>
    </Sheet>
  );
}

/** Completed with zero sessions left: the coach decides, sales hears about it this second. */
export function UnpaidConfirmSheet({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title={t("today.unpaidTitle")} closeLabel={t("common.close")}>
      <div className="grid gap-4">
        <p>{t("today.unpaidBody", { name })}</p>
        <Button size="block" onClick={onConfirm}>{t("today.deliverAnyway")}</Button>
        <Button size="block" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
      </div>
    </Sheet>
  );
}
