"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { t } from "@gymos/i18n";
import { dealErrorKey } from "@gymos/api/deals/errors";
import { useMoneyMutation } from "@gymos/api/deals/use-deals";
import { egpToPiastres } from "@gymos/api/deals/labels";
import { dealKeys, saveDraft, submitDeal, type Deal, type Draft } from "@gymos/api/deals/deals";
import { DealItemsEditor } from "./deal-items-editor";
import { DealSummary } from "./deal-summary";

const toDraft = (d: Deal): Draft => ({
  items: d.items.map((i) => ({ product_id: i.product_id, qty: i.qty, provider_membership_id: i.provider_membership_id })),
  discount_pct: Number(d.discount_pct),
  discount_fixed_piastres: d.discount_fixed_piastres,
  payment_plan: d.payment_plan,
  installments_count: d.installments_count,
  notes: d.notes ?? "",
});

/** Draft deal: items, coach per PT pack, discount, plan. Saves (and re-prices on the server) as you go; Submit last. */
export function DealBuilder({ deal }: { deal: Deal }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => toDraft(deal));
  const [fixedEgp, setFixedEgp] = useState(deal.discount_fixed_piastres ? String(deal.discount_fixed_piastres / 100) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const first = useRef(true);

  async function persist(d: Draft) {
    setSaving(true);
    try {
      const saved = await saveDraft(deal.id, d);
      queryClient.setQueryData(dealKeys.detail(deal.id), saved);
      setError(null);
      return saved;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (first.current) return void (first.current = false);
    const id = setTimeout(() => void persist(draft).catch(() => undefined), 400);
    return () => clearTimeout(id);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps -- persist is stable enough; only draft changes trigger a save

  const submit = useMoneyMutation(async () => {
    const saved = await persist(draft); // flush the latest edits before submitting
    if (saved.issues.length) throw new Error("PT pack must be recorded under a coach");
    return submitDeal(deal.id);
  });

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const blocked = draft.items.length === 0 || draft.items.some((i) => i.provider_membership_id === null && deal.items.find((x) => x.product_id === i.product_id)?.product_type === "pt_pack");

  return (
    <div className="grid gap-4 pb-24 md:grid-cols-[1fr_20rem] md:pb-0">
      <div className="grid content-start gap-4">
        <DealItemsEditor deal={deal} items={draft.items} onChange={(items) => set({ items })} />
        <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
          <Field label={t("deal.discountPct")} htmlFor="discount-pct">
            <Input id="discount-pct" type="number" inputMode="decimal" min={0} max={100} value={draft.discount_pct || ""} onChange={(e) => set({ discount_pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
          </Field>
          <Field label={t("deal.discountFixed")} htmlFor="discount-fixed">
            <Input
              id="discount-fixed"
              inputMode="decimal"
              value={fixedEgp}
              onChange={(e) => {
                setFixedEgp(e.target.value);
                set({ discount_fixed_piastres: egpToPiastres(e.target.value) ?? 0 });
              }}
            />
          </Field>
          <Field label={t("deal.plan")} htmlFor="plan">
            <Select id="plan" value={draft.payment_plan} onChange={(e) => set({ payment_plan: e.target.value as Draft["payment_plan"], installments_count: e.target.value === "installments" ? 2 : 1 })}>
              <option value="single">{t("deal.plan.single")}</option>
              <option value="installments">{t("deal.plan.installments")}</option>
            </Select>
          </Field>
          {draft.payment_plan === "installments" ? (
            <Field label={t("deal.installments")} htmlFor="installments">
              <Input id="installments" type="number" min={2} max={12} value={draft.installments_count} onChange={(e) => set({ installments_count: Math.max(2, Number(e.target.value) || 2) })} />
            </Field>
          ) : null}
          <Field label={t("deal.notes")} htmlFor="deal-notes" className="md:col-span-2">
            <Textarea id="deal-notes" className="font-sans" value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
      </div>
      <div className="grid content-start gap-3">
        <DealSummary deal={deal} saving={saving} />
        {error || submit.isError ? <p role="alert" className="text-sm text-destructive">{t(dealErrorKey(submit.error ?? error))}</p> : null}
        <div className="fixed inset-x-0 bottom-bottom-bar z-20 border-t bg-background p-3 md:static md:border-0 md:p-0">
          <Button size="block" disabled={blocked || saving || submit.isPending} onClick={() => submit.mutate(undefined)}>
            {deal.approval_preview?.needs_approval ? t("deal.submitForApproval") : t("deal.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
