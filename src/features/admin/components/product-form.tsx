"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMe } from "@/features/auth/me-context";
import { dealErrorKey } from "@/features/deals/errors";
import { egpToPiastres, PRODUCT_TYPES, productTypeLabel } from "@/features/deals/labels";
import { t } from "@/lib/i18n";
import { productKeys, saveProduct, type Product, type ProductDraft, type ProductInput } from "../queries/products";

const num = (v: string) => (v.trim() === "" ? null : Number(v));

/** Add / edit a product, or add a branch price for an existing code. Existing deals keep their snapshot prices. */
export function ProductForm({ product, catalog, onDone }: { product: ProductDraft; catalog: Product[]; onDone: () => void }) {
  const { branches } = useMe();
  const queryClient = useQueryClient();
  const [f, setF] = useState({
    code: product.code ?? "",
    name: product.name ?? "",
    type: product.type ?? "membership",
    branchId: product.branch_id ?? "",
    price: product.price_piastres != null ? String(product.price_piastres / 100) : "",
    duration: product.duration_days?.toString() ?? "",
    sessions: product.session_count?.toString() ?? "",
    expiry: product.expiry_days?.toString() ?? "",
    minutes: String(product.session_minutes ?? 60),
    active: product.is_active ?? true,
    sort: String(product.sort_order ?? 0),
    bundle: product.bundle_items ?? [],
  });
  const save = useMutation({ mutationFn: (p: ProductInput) => saveProduct(p), onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }) });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const price = egpToPiastres(f.price);

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (price === null) return;
        save.mutate(
          { id: product.id ?? null, code: f.code, name: f.name, type: f.type, branchId: f.branchId || null, pricePiastres: price, durationDays: num(f.duration), sessionCount: num(f.sessions),
            expiryDays: num(f.expiry), sessionMinutes: Number(f.minutes) || 60, isActive: f.active, sortOrder: Number(f.sort) || 0, bundleItems: f.bundle },
          { onSuccess: onDone },
        );
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("product.code")} htmlFor="p-code"><Input id="p-code" value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} /></Field>
        <Field label={t("product.typeLabel")} htmlFor="p-type">
          <Select id="p-type" value={f.type} onChange={(e) => set({ type: e.target.value as typeof f.type })}>
            {PRODUCT_TYPES.map((x) => <option key={x} value={x}>{t(productTypeLabel(x))}</option>)}
          </Select>
        </Field>
      </div>
      <Field label={t("product.name")} htmlFor="p-name"><Input id="p-name" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("product.branch")} htmlFor="p-branch">
          <Select id="p-branch" value={f.branchId} onChange={(e) => set({ branchId: e.target.value })}>
            <option value="">{t("shell.allBranches")}</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label={t("product.price")} htmlFor="p-price" error={f.price && price === null ? t("payment.error.amount") : undefined}>
          <Input id="p-price" inputMode="decimal" value={f.price} onChange={(e) => set({ price: e.target.value })} />
        </Field>
      </div>
      {f.type === "membership" || f.type === "nutrition" ? (
        <Field label={t("product.duration")} htmlFor="p-duration"><Input id="p-duration" type="number" min={1} value={f.duration} onChange={(e) => set({ duration: e.target.value })} /></Field>
      ) : null}
      {f.type === "pt_pack" ? (
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("product.sessions")} htmlFor="p-sessions"><Input id="p-sessions" type="number" min={1} value={f.sessions} onChange={(e) => set({ sessions: e.target.value })} /></Field>
          <Field label={t("product.expiry")} htmlFor="p-expiry"><Input id="p-expiry" type="number" min={1} value={f.expiry} onChange={(e) => set({ expiry: e.target.value })} /></Field>
          <Field label={t("product.minutes")} htmlFor="p-minutes"><Input id="p-minutes" type="number" min={15} value={f.minutes} onChange={(e) => set({ minutes: e.target.value })} /></Field>
        </div>
      ) : null}
      {f.type === "bundle" ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">{t("product.contains")}</legend>
          {catalog.filter((p) => p.type !== "bundle").map((p) => {
            const on = f.bundle.some((b) => b.product_id === p.id);
            return (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-primary" checked={on} onChange={() => set({ bundle: on ? f.bundle.filter((b) => b.product_id !== p.id) : [...f.bundle, { product_id: p.id, qty: 1 }] })} />
                {p.name}{p.branch_id ? ` (${branches.find((b) => b.id === p.branch_id)?.code})` : ""}
              </label>
            );
          })}
          <p className="text-xs text-muted-foreground">{t("product.bundleNote")}</p>
        </fieldset>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <span id="p-active" className="text-sm font-medium">{t("product.active")}</span>
        <Switch aria-labelledby="p-active" checked={f.active} onCheckedChange={(v) => set({ active: v })} />
      </div>
      {save.isError ? <p role="alert" className="text-sm text-destructive">{t(dealErrorKey(save.error))}</p> : null}
      <Button type="submit" size="block" disabled={save.isPending || price === null || !f.code.trim() || !f.name.trim()}>{t("common.save")}</Button>
    </form>
  );
}
