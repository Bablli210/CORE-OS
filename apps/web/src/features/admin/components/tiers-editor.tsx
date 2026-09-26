"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@gymos/i18n";
import type { Tier } from "@gymos/api/admin/settings-model";

/** Commission tiers as a small table: "up to N sessions → P %"; the last tier has no upper limit. */
export function TiersEditor({ id, tiers, onChange }: { id: string; tiers: Tier[]; onChange: (tiers: Tier[]) => void }) {
  const update = (i: number, patch: Partial<Tier>) => onChange(tiers.map((tier, j) => (j === i ? { ...tier, ...patch } : tier)));
  const num = (v: string) => (v === "" ? NaN : Number(v));
  return (
    <div className="grid gap-2">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="pb-1 text-start font-medium">{t("settings.tiers.upTo")}</th>
            <th className="pb-1 text-start font-medium">{t("settings.tiers.pct")}</th>
            <th className="w-12"><span className="sr-only">{t("settings.tiers.remove")}</span></th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier, i) => {
            const last = i === tiers.length - 1;
            return (
              <tr key={i}>
                <td className="py-1 pe-2">
                  {last ? (
                    <span className="text-muted-foreground">{t("settings.tiers.andAbove")}</span>
                  ) : (
                    <Input
                      aria-label={t("settings.tiers.upToRow", { n: i + 1 })}
                      id={i === 0 ? id : undefined}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={Number.isNaN(tier.upTo) || tier.upTo === null ? "" : tier.upTo}
                      onChange={(e) => update(i, { upTo: num(e.target.value) })}
                    />
                  )}
                </td>
                <td className="py-1 pe-2">
                  <Input
                    aria-label={t("settings.tiers.pctRow", { n: i + 1 })}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    value={Number.isNaN(tier.pct) ? "" : tier.pct}
                    onChange={(e) => update(i, { pct: num(e.target.value) })}
                  />
                </td>
                <td className="py-1">
                  {tiers.length > 1 ? (
                    <Button variant="ghost" size="icon" aria-label={t("settings.tiers.removeRow", { n: i + 1 })} onClick={() => onChange(tiers.filter((_, j) => j !== i))}>
                      <Trash2 aria-hidden />
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Button
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => {
          const prevLimit = tiers.length > 1 ? (tiers[tiers.length - 2].upTo ?? 0) : 0;
          const next = [...tiers];
          next.splice(tiers.length - 1, 0, { upTo: prevLimit + 40, pct: tiers[tiers.length - 1]?.pct ?? 0 });
          onChange(next);
        }}
      >
        <Plus aria-hidden />
        {t("settings.tiers.add")}
      </Button>
    </div>
  );
}
