"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { LIVE_KEY } from "@gymos/api/notifications/notifications";
import { formatEGP } from "@gymos/api/format";
import { t, type MessageKey } from "@gymos/i18n";
import { recordPayment, type PaymentResult } from "../actions";
import { egpToPiastres, methodLabel, PAYMENT_METHODS, type PaymentMethod } from "@gymos/api/deals/labels";
import { dealKeys, type Deal } from "@gymos/api/deals/deals";

/** Record payment (docs/04): amount, method, reference, date → fn_record_payment (+ provision-client on first payment). */
export function PaymentSheet({ deal, open, onClose, onRecorded }: { deal: Deal; open: boolean; onClose: () => void; onRecorded: (r: PaymentResult) => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(String(deal.remaining_piastres / 100));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<{ key: MessageKey; vars?: Record<string, string> } | null>(null);
  const [pending, start] = useTransition();

  return (
    <Sheet open={open} onClose={onClose} title={t("payment.title")} closeLabel={t("common.close")}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const piastres = egpToPiastres(amount);
          if (!piastres) return setError({ key: "payment.error.amount" });
          start(async () => {
            setError(null);
            const r = await recordPayment({ dealId: deal.id, amountPiastres: piastres, method, reference, receivedAt: date ? new Date(date).toISOString() : undefined });
            if (r.error) return setError({ key: r.error, vars: r.errorVars });
            await Promise.all([dealKeys.all, LIVE_KEY, ["leads"], ["credits"]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
            onRecorded(r);
            onClose();
          });
        }}
      >
        <p className="text-sm text-muted-foreground">
          {t("payment.remaining", { amount: formatEGP(deal.remaining_piastres) })}
          {deal.min_first_payment_piastres ? ` · ${t("payment.minFirst", { amount: formatEGP(deal.min_first_payment_piastres) })}` : ""}
        </p>
        <Field label={t("payment.amount")} htmlFor="pay-amount" error={error?.key.startsWith("payment.error.") ? t(error.key, error.vars) : undefined}>
          <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={t("payment.methodLabel")} htmlFor="pay-method">
          <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(methodLabel(m))}</option>)}
          </Select>
        </Field>
        <Field label={t("payment.reference")} htmlFor="pay-ref">
          <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label={t("payment.date")} htmlFor="pay-date" hint={t("payment.dateHint")}>
          <Input id="pay-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {error && !error.key.startsWith("payment.error.") ? <p role="alert" className="text-sm text-destructive">{t(error.key, error.vars)}</p> : null}
        <Button type="submit" size="block" disabled={pending}>{pending ? t("payment.saving") : t("payment.record")}</Button>
      </form>
    </Sheet>
  );
}
