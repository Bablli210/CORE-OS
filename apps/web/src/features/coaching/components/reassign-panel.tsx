"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { coachingErrorKey } from "@/features/sessions/errors";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCoachingMutation, useRanked } from "../hooks/use-coaching";
import { assignCoach, type Team } from "../queries/coaching";

/** Reassign a client: pick the client, pick from fn_rank_coaches suggestions, give a reason → fn_assign_coach. */
export function ReassignPanel({ clients, onDone }: { clients: Team["clients"]; onDone: (message: string) => void }) {
  const [clientId, setClientId] = useState("");
  const [coach, setCoach] = useState("");
  const [reason, setReason] = useState("");
  const client = clients.find((c) => c.id === clientId);
  const ranked = useRanked(clientId || null);
  const options = (ranked.data ?? []).filter((r) => r.coach_membership_id !== client?.coach_membership_id);
  const assign = useCoachingMutation(() => assignCoach(clientId, coach, reason.trim()));
  const target = options.find((o) => o.coach_membership_id === coach);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (client && target && reason.trim())
          assign.mutate(undefined, {
            onSuccess: () => {
              onDone(t("coachTeam.reassigned", { client: client.full_name, coach: target.coach_name }));
              setClientId(""); setCoach(""); setReason("");
            },
          });
      }}
    >
      <Field label={t("coachTeam.pickClient")} htmlFor="reassign-client">
        <Select id="reassign-client" value={clientId} onChange={(e) => { setClientId(e.target.value); setCoach(""); }}>
          <option value="">{t("schedule.pickClient")}</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{t("coachTeam.clientOption", { name: c.full_name, coach: c.coach_name ?? "—", n: c.credits_left })}</option>)}
        </Select>
      </Field>
      {client ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{t("coachTeam.newCoach")}</legend>
          {ranked.isPending ? <p className="text-sm text-muted-foreground">{t("common.loading")}</p> : null}
          <div role="radiogroup" data-testid="reassign-suggestions" className="grid gap-2 md:grid-cols-2">
            {options.map((o) => (
              <button key={o.coach_membership_id} type="button" role="radio" aria-checked={coach === o.coach_membership_id} onClick={() => setCoach(o.coach_membership_id)}
                className={cn("grid gap-0.5 rounded-lg border p-3 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", coach === o.coach_membership_id ? "border-primary bg-primary/5" : "hover:bg-accent")}>
                <span className="font-medium">{o.coach_name}</span>
                <span className="text-muted-foreground">{t("coachTeam.rankLine", { n: o.active_clients, cap: o.capacity, score: o.score })}{o.over_capacity ? ` · ${t("coachTeam.full")}` : ""}</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{t("coachTeam.reassignHint", { n: client.credits_left })}</p>
        </fieldset>
      ) : null}
      <Field label={t("common.reasonRequired")} htmlFor="reassign-reason">
        <Textarea id="reassign-reason" className="font-sans" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {assign.isError ? <p role="alert" className="text-sm text-destructive">{t(coachingErrorKey(assign.error))}</p> : null}
      <Button type="submit" size="block" className="md:w-auto md:justify-self-start" disabled={!target || !reason.trim() || assign.isPending}>{t("coachTeam.reassign")}</Button>
    </form>
  );
}
