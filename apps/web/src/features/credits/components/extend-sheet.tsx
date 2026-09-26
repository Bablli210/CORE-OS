"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { dealErrorKey } from "@gymos/api/deals/errors";
import { useMoneyMutation } from "@gymos/api/deals/use-deals";
import { formatDate } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { extendExpiry, type Lot } from "@gymos/api/credits/sales-client";

/** Extend a pack's expiry. Sales manager: applied at once. Rep: sent to the sales manager as an approval. */
export function ExtendSheet({ lot, direct, onClose, onDone }: { lot: Lot; direct: boolean; onClose: () => void; onDone: (pending: boolean) => void }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const m = useMoneyMutation(() => extendExpiry(lot.id, new Date(`${date}T23:59:00`).toISOString(), reason.trim()));
  return (
    <Sheet open onClose={onClose} title={t("extend.title", { coach: lot.coach_name ?? "" })} closeLabel={t("common.close")}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (date && reason.trim()) m.mutate(undefined, { onSuccess: (r) => { onDone(!r.ok); onClose(); } });
        }}
      >
        <p className="text-sm text-muted-foreground">
          {t("extend.current", { date: formatDate(lot.expires_at) })}
          {lot.status === "expired" && lot.expired_qty ? ` ${t("extend.revive", { n: lot.expired_qty })}` : ""}
        </p>
        <Field label={t("extend.newDate")} htmlFor="extend-date">
          <Input id="extend-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t("common.reasonRequired")} htmlFor="extend-reason">
          <Textarea id="extend-reason" className="font-sans" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {m.isError ? <p role="alert" className="text-sm text-destructive">{t(dealErrorKey(m.error))}</p> : null}
        <Button type="submit" size="block" disabled={!date || !reason.trim() || m.isPending}>{direct ? t("extend.apply") : t("extend.request")}</Button>
      </form>
    </Sheet>
  );
}
