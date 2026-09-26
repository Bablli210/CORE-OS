"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { t } from "@gymos/i18n";
import { analyticsKeys, saveTarget, type TargetRow } from "@gymos/api/analytics/analytics";

/**
 * One inline target: EGP for money (stored in piastres), a count otherwise. Saves on blur or Enter through
 * fn_save_target (emits target.saved); empty clears it. The saved value is what the database returns on refetch.
 */
export function TargetCell({ row, period, label }: { row: TargetRow; period: string; label: string }) {
  const queryClient = useQueryClient();
  const money = row.unit === "money";
  const shown = row.target === null ? "" : String(money ? Number(row.target) / 100 : Number(row.target));
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (value: number | null) => saveTarget(row, period, value),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
      setDraft(null);
    },
  });
  const commit = () => {
    if (draft === null || draft === shown) return setDraft(null);
    const n = draft.trim() === "" ? null : Math.round(Number(draft) * (money ? 100 : 1));
    if (n !== null && (!Number.isFinite(n) || n < 0)) return;
    save.mutate(n);
  };
  const invalid = draft !== null && draft.trim() !== "" && !(Number(draft) >= 0);
  return (
    <div className="grid gap-0.5">
      <div className="flex items-center gap-1">
        <Input
          inputMode="decimal"
          value={draft ?? shown}
          placeholder="—"
          aria-label={label}
          aria-invalid={invalid || save.isError}
          data-testid="target-input"
          data-scope={row.scope_id}
          data-metric={row.metric}
          className="h-9 w-28 text-end tabular-nums"
          disabled={save.isPending}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setDraft(null); }}
        />
        {save.isSuccess && draft === null ? <Check aria-label={t("targets.saved")} className="size-4 text-success" /> : null}
      </div>
      {invalid ? <span className="text-xs text-destructive">{t("targets.invalid")}</span> : null}
      {save.isError ? <span role="alert" className="text-xs text-destructive">{t("targets.error")}</span> : null}
    </div>
  );
}
