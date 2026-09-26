"use client";

import { t, type MessageKey } from "@gymos/i18n";
import { cn } from "@/lib/utils";
import { WEEK_ORDER } from "@gymos/api/sessions/week";

/** Weekday toggles in gym-week order (Sat first). Multi-select, keyboard reachable, 44px targets. */
export function DayChips({ value, onChange, label }: { value: number[]; onChange: (days: number[]) => void; label: string }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {WEEK_ORDER.map((d) => {
          const on = value.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={t(`weekday.${d}` as MessageKey)}
              onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d])}
              className={cn(
                "min-h-tap min-w-tap rounded-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
              )}
            >
              {t(`weekday.short.${d}` as MessageKey)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
