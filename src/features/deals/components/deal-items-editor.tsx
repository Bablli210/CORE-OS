"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { formatEGP } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useCatalog } from "../hooks/use-deals";
import { productTypeLabel } from "../labels";
import type { Deal, DraftItem } from "../queries/deals";
import { CoachPicker } from "./coach-picker";

/** Line items: pick products from the branch catalog; each PT pack names its coach. Prices shown are catalog prices. */
export function DealItemsEditor({ deal, items, onChange }: { deal: Deal; items: DraftItem[]; onChange: (items: DraftItem[]) => void }) {
  const catalog = useCatalog(deal.branch_id);
  const [pick, setPick] = useState("");
  const byId = new Map((catalog.data ?? []).map((p) => [p.id, p]));
  const saved = new Map(deal.items.map((i) => [i.product_id, i]));

  return (
    <div className="grid gap-3">
      <ul className="grid gap-3" data-testid="deal-items">
        {items.length === 0 ? <li className="text-sm text-muted-foreground">{t("deal.noItems")}</li> : null}
        {items.map((item, idx) => {
          const p = byId.get(item.product_id);
          const s = saved.get(item.product_id);
          return (
            <li key={`${item.product_id}-${idx}`} className="grid gap-3 rounded-lg border p-3" data-testid="deal-item">
              <div className="flex items-start justify-between gap-2">
                <span className="grid">
                  <span className="font-medium">{p?.name ?? s?.product_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p ? `${t(productTypeLabel(p.type))} · ${formatEGP(p.price_piastres ?? 0)}` : null}
                    {s?.per_session_piastres ? ` · ${t("deal.perSession", { gross: formatEGP(s.per_session_piastres), net: formatEGP(s.net_per_session_piastres ?? 0) })}` : null}
                  </span>
                </span>
                <Button variant="ghost" size="icon" aria-label={t("deal.removeItem", { name: p?.name ?? "" })} onClick={() => onChange(items.filter((_, j) => j !== idx))}>
                  <Trash2 aria-hidden />
                </Button>
              </div>
              {p?.type === "pt_pack" ? (
                <div className="grid gap-1">
                  <span className="text-sm font-medium">{t("coach.forPack")}</span>
                  <CoachPicker
                    id={`coach-${idx}`}
                    branchId={deal.branch_id}
                    leadId={deal.lead?.id}
                    clientId={deal.lead ? undefined : deal.client?.id}
                    value={item.provider_membership_id}
                    onChange={(v) => onChange(items.map((x, j) => (j === idx ? { ...x, provider_membership_id: v } : x)))}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">{t("deal.addProduct")}</span>
          <Select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={t("deal.addProduct")}>
            <option value="">{t("deal.pickProduct")}</option>
            {(catalog.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatEGP(p.price_piastres ?? 0)}
              </option>
            ))}
          </Select>
        </label>
        <Button
          variant="outline"
          disabled={!pick}
          onClick={() => {
            onChange([...items, { product_id: pick, qty: 1, provider_membership_id: null }]);
            setPick("");
          }}
        >
          <Plus aria-hidden />
          {t("deal.add")}
        </Button>
      </div>
    </div>
  );
}
