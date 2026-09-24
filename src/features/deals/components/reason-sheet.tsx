"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { t } from "@/lib/i18n";
import { dealErrorKey } from "../errors";
import { useMoneyMutation } from "../hooks/use-deals";

/** A reason-required action (void a payment, cancel a deal). */
export function ReasonSheet({ open, onClose, title, action, submitLabel, run }: { open: boolean; onClose: () => void; title: string; action: string; submitLabel: string; run: (reason: string) => Promise<unknown> }) {
  const [reason, setReason] = useState("");
  const m = useMoneyMutation(run);
  return (
    <Sheet open={open} onClose={onClose} title={title} closeLabel={t("common.close")}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (reason.trim()) m.mutate(reason.trim(), { onSuccess: onClose }); }}>
        <p className="text-sm text-muted-foreground">{action}</p>
        <Field label={t("common.reasonRequired")} htmlFor="reason-text">
          <Textarea id="reason-text" className="font-sans" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {m.isError ? <p role="alert" className="text-sm text-destructive">{t(dealErrorKey(m.error))}</p> : null}
        <Button type="submit" size="block" disabled={!reason.trim() || m.isPending}>{submitLabel}</Button>
      </form>
    </Sheet>
  );
}
