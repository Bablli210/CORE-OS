"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { ErrorState, LoadingList } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useMe } from "@/features/auth/me-context";
import { PRODUCT_TYPES, productTypeLabel } from "@/features/deals/labels";
import { formatEGP } from "@/lib/format";
import { t } from "@/lib/i18n";
import { fetchProducts, productKeys, type Product, type ProductDraft } from "../queries/products";
import { ProductForm } from "./product-form";

/** docs/04 /admin/settings products editor: catalog by type, per-branch prices, pack expiry days, bundles. */
export function ProductsEditor() {
  const { branches } = useMe();
  const { data, isPending, isError, refetch } = useQuery({ queryKey: productKeys.all, queryFn: fetchProducts });
  const [editing, setEditing] = useState<ProductDraft | null>(null);
  if (isPending) return <LoadingList label={t("common.loading")} />;
  if (isError) return <ErrorState title={t("product.error.load")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />;
  const branchCode = (id: string | null) => (id ? (branches.find((b) => b.id === id)?.code ?? "?") : t("shell.allBranches"));
  const detail = (p: Product) =>
    p.type === "pt_pack" ? t("product.packDetail", { n: p.session_count ?? 0, days: p.expiry_days ?? "—" }) : p.type === "bundle" ? t("product.bundleDetail", { n: p.bundle_items.length }) : t("product.daysDetail", { n: p.duration_days ?? 0 });

  return (
    <div className="grid gap-4">
      <Button className="justify-self-start" onClick={() => setEditing({ id: null })}><Plus aria-hidden />{t("product.add")}</Button>
      {PRODUCT_TYPES.map((type) => {
        const rows = data.filter((p) => p.type === type);
        if (!rows.length) return null;
        return (
          <section key={type} className="rounded-lg border px-4" aria-labelledby={`pt-${type}`}>
            <h2 id={`pt-${type}`} className="border-b py-3 font-semibold">{t(productTypeLabel(type))}</h2>
            <ul>
              {rows.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-3 last:border-0" data-testid={`product-${p.code}-${p.branch_id ? branchCode(p.branch_id) : "all"}`}>
                  <span className="grid">
                    <span className="font-medium">{p.name} <span className="text-xs text-muted-foreground">{p.code}</span></span>
                    <span className="text-sm text-muted-foreground">{[branchCode(p.branch_id), formatEGP(p.price_piastres), detail(p)].join(" · ")}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {!p.is_active ? <Badge variant="destructive">{t("people.inactive")}</Badge> : null}
                    {!p.branch_id ? <Button size="sm" variant="outline" onClick={() => setEditing({ ...p, id: null, branch_id: branches[0]?.id ?? null })}>{t("product.branchPrice")}</Button> : null}
                    <Button size="sm" variant="outline" onClick={() => setEditing(p)}>{t("common.edit")}</Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {editing ? (
        <Sheet open onClose={() => setEditing(null)} title={editing.id ? t("product.edit", { name: editing.name ?? "" }) : t("product.add")} closeLabel={t("common.close")}>
          <ProductForm product={editing} catalog={data} onDone={() => setEditing(null)} />
        </Sheet>
      ) : null}
    </div>
  );
}
