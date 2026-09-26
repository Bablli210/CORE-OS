"use client";

import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useBranchCoaches, useRankedCoaches } from "../hooks/use-deals";

/**
 * docs/04: a PT line needs a coach. fn_rank_coaches suggestions first (why: gender preference, time, specialties, load),
 * then every coach of the branch.
 */
export function CoachPicker({ id, branchId, leadId, clientId, value, onChange }: { id: string; branchId: string; leadId?: string; clientId?: string; value: string | null; onChange: (id: string | null) => void }) {
  const ranked = useRankedCoaches(leadId, clientId);
  const all = useBranchCoaches(branchId);
  const suggested = (ranked.data ?? []).slice(0, 3);
  return (
    <div className="grid gap-2">
      {suggested.length ? (
        <div role="radiogroup" aria-label={t("coach.suggested")} className="grid gap-2" data-testid="coach-suggestions">
          <span className="text-xs font-medium text-muted-foreground">{t("coach.suggested")}</span>
          {suggested.map((c) => {
            const r = c.reasons as { day_overlap: number; specialty_matches: number; load: number; capacity: number };
            const on = value === c.coach_membership_id;
            return (
              <button
                key={c.coach_membership_id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(c.coach_membership_id)}
                className={cn("grid gap-1 rounded-md border p-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", on && "border-primary bg-accent")}
              >
                <span className="flex items-center justify-between gap-2 font-medium">
                  {c.coach_name}
                  {c.over_capacity ? <Badge variant="warning">{t("coach.full")}</Badge> : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {[t("coach.days", { n: r.day_overlap }), r.specialty_matches ? t("coach.specialties", { n: r.specialty_matches }) : null, t("coach.load", { load: r.load, capacity: r.capacity })]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <label className="grid gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t("coach.allCoaches")}</span>
        <Select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} aria-invalid={!value || undefined}>
          <option value="">{t("coach.pick")}</option>
          {(all.data ?? []).map((c) => (
            <option key={c.membership_id} value={c.membership_id}>
              {c.full_name} ({c.active_clients}/{c.capacity})
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
