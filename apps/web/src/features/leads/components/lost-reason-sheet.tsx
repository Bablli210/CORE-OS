"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { t } from "@/lib/i18n";
import { useSalesMutation } from "../hooks/use-leads";
import { LOST_REASONS, lostReasonLabel, type LostReason } from "../labels";
import { setLeadStage } from "../queries/leads";
import { salesErrorKey } from "../errors";

/** Marking a lead lost needs a reason from the fixed list (docs/03 §1); Confirm stays disabled until one is picked. */
export function LostReasonSheet({ open, onClose, lead }: { open: boolean; onClose: () => void; lead: { id: string; name: string } }) {
  const [reason, setReason] = useState<LostReason | null>(null);
  const [note, setNote] = useState("");
  const save = useSalesMutation(({ id, r, n }: { id: string; r: LostReason; n: string }) => setLeadStage(id, "lost", r, n));

  return (
    <Sheet open={open} onClose={onClose} title={t("leads.lostTitle", { name: lead.name })} closeLabel={t("common.close")}>
      <div className="grid gap-4">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{t("leads.lostReason")}</legend>
          {LOST_REASONS.map((r) => (
            <label key={r} className="flex min-h-tap items-center gap-3 rounded-md border px-3 has-[:checked]:border-primary">
              <input type="radio" name="lost-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-primary" />
              {t(lostReasonLabel(r))}
            </label>
          ))}
        </fieldset>
        <Field label={t("leads.lostNote")} htmlFor="lost-note">
          <Textarea id="lost-note" className="font-sans" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {save.isError ? <p role="alert" className="text-sm text-destructive">{t(salesErrorKey(save.error))}</p> : null}
        <Button
          variant="destructive"
          size="block"
          disabled={!reason || save.isPending}
          onClick={() => reason && save.mutate({ id: lead.id, r: reason, n: note }, { onSuccess: onClose })}
        >
          {t("leads.markLost")}
        </Button>
      </div>
    </Sheet>
  );
}
