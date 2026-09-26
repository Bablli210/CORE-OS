"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { t } from "@gymos/i18n";
import { useReps, useSalesMutation } from "@gymos/api/leads/use-leads";
import { assignLead } from "@gymos/api/leads/leads";
import { salesErrorKey } from "@gymos/api/leads/errors";

/** Sales manager: assign or reassign a lead. Reassigning needs a reason; both reps are notified (fn_assign_lead). */
export function ReassignSheet({ open, onClose, lead }: { open: boolean; onClose: () => void; lead: { id: string; name: string; branchId: string; ownerId: string | null } }) {
  const reps = useReps(lead.branchId);
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const save = useSalesMutation(({ m, r }: { m: string; r: string }) => assignLead(lead.id, m, r));
  const needsReason = lead.ownerId !== null;
  const reasonError = tried && needsReason && reason.trim() === "" ? t("leads.error.reasonRequired") : undefined;

  return (
    <Sheet open={open} onClose={onClose} title={t(needsReason ? "leads.reassignTitle" : "leads.assignTitle", { name: lead.name })} closeLabel={t("common.close")}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (!to || (needsReason && reason.trim() === "")) return;
          save.mutate({ m: to, r: reason.trim() }, { onSuccess: onClose });
        }}
      >
        <Field label={t("leads.assignTo")} htmlFor="assign-to" error={tried && !to ? t("leads.error.pickRep") : undefined}>
          <Select id="assign-to" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">{t("leads.pickRep")}</option>
            {(reps.data ?? [])
              .filter((r) => r.membership_id !== lead.ownerId)
              .map((r) => (
                <option key={r.membership_id} value={r.membership_id}>
                  {r.full_name}
                  {r.rotation_paused ? ` (${t("team.paused")})` : ""}
                </option>
              ))}
          </Select>
        </Field>
        {needsReason ? (
          <Field label={t("leads.reassignReason")} htmlFor="assign-reason" hint={t("leads.reassignHint")} error={reasonError}>
            <Textarea id="assign-reason" className="font-sans" value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!reasonError} />
          </Field>
        ) : null}
        {save.isError ? <p role="alert" className="text-sm text-destructive">{t(salesErrorKey(save.error))}</p> : null}
        <Button type="submit" size="block" disabled={save.isPending}>
          {needsReason ? t("leads.reassign") : t("leads.assign")}
        </Button>
      </form>
    </Sheet>
  );
}
