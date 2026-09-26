import { Check } from "lucide-react";
import { t } from "@gymos/i18n";
import { OPEN_STAGES, stageLabel, type LeadStatus } from "@gymos/api/leads/labels";
import { cn } from "@/lib/utils";

const STEPS = [...OPEN_STAGES, "won"] as const;

/** Where the lead is on the way to a sale: New → Contacted → Onboarded → Quoted → Won. A lost lead shows no step. */
export function LeadStepper({ status }: { status: LeadStatus }) {
  if (status === "lost") return null;
  const current = STEPS.indexOf(status as (typeof STEPS)[number]);
  return (
    <ol aria-label={t("leads.progress")} className="grid grid-cols-5 gap-1" data-testid="lead-stepper">
      {STEPS.map((s, i) => {
        const done = i < current || status === "won";
        const here = i === current;
        return (
          <li key={s} aria-current={here ? "step" : undefined} className="grid gap-1.5">
            <span className={cn("h-1.5 rounded-full", done ? "bg-foreground" : here ? "bg-foreground/50" : "bg-muted")} />
            <span className={cn("flex items-center gap-1 truncate text-xs", here ? "font-medium text-foreground" : "text-muted-foreground")}>
              {done ? <Check aria-hidden className="size-3 shrink-0" /> : null}
              {t(stageLabel(s))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
