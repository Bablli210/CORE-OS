"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { PhoneInput } from "@/components/phone-input";
import { Sheet } from "@/components/ui/sheet";
import { dealErrorKey } from "@/features/deals/errors";
import { useMoneyMutation } from "@/features/deals/hooks/use-deals";
import { t } from "@/lib/i18n";
import { findByPhone, requestTransfer, type Lot, type PhoneMatch } from "../queries/sales-client";

/**
 * Move a pack's remaining sessions to another client (same coach). Pick the client by phone, give the reason; the sales
 * manager approves in the queue (fn_request_transfer → fn_decide_approval 'transfer').
 */
export function TransferSheet({ lot, onClose, onDone }: { lot: Lot; onClose: () => void; onDone: () => void }) {
  const [phone, setPhone] = useState("");
  const [match, setMatch] = useState<PhoneMatch | null>(null);
  const [looking, setLooking] = useState(false);
  const [reason, setReason] = useState("");
  const m = useMoneyMutation(() => requestTransfer(lot.id, match!.id!, reason.trim()));
  const target = match?.found && match.kind === "client" && match.visible ? match : null;

  const lookUp = async () => {
    setLooking(true);
    try {
      setMatch(await findByPhone(phone));
    } catch {
      setMatch({ found: false });
    } finally {
      setLooking(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={t("transfer.title", { n: lot.qty_remaining, coach: lot.coach_name ?? "" })} closeLabel={t("common.close")}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (target && reason.trim()) m.mutate(undefined, { onSuccess: onDone }); }}>
        <Field label={t("transfer.to")} htmlFor="transfer-phone">
          <span className="flex gap-2">
            <PhoneInput id="transfer-phone" value={phone} onChange={(v) => { setPhone(v); setMatch(null); }} />
            <Button type="button" variant="outline" disabled={!phone || looking} onClick={lookUp}>{t("transfer.find")}</Button>
          </span>
        </Field>
        {match ? (
          <p role="status" className="text-sm" data-testid="transfer-target">
            {target ? t("transfer.found", { name: target.name ?? "", branch: target.branch_code ?? "" }) : match.found && match.kind === "lead" ? t("transfer.isLead") : t("transfer.notFound")}
          </p>
        ) : null}
        <Field label={t("common.reasonRequired")} htmlFor="transfer-reason"><Textarea id="transfer-reason" className="font-sans" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <p className="text-sm text-muted-foreground">{t("transfer.hint")}</p>
        {m.isError ? <p role="alert" className="text-sm text-destructive">{t(dealErrorKey(m.error))}</p> : null}
        <Button type="submit" size="block" disabled={!target || !reason.trim() || m.isPending}>{t("transfer.send")}</Button>
      </form>
    </Sheet>
  );
}
