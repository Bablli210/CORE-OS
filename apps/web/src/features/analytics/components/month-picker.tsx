"use client";

import { Select } from "@/components/ui/input";
import { cairoMonth } from "@gymos/api/format";
import { t } from "@gymos/i18n";

/** The last 12 months (the views keep 12), newest first; `ahead` adds coming months first (targets are set in advance). */
export function lastMonths(n = 12, now = new Date(), ahead = 0): string[] {
  const [y, m] = cairoMonth(now).split("-").map(Number);
  return Array.from({ length: n + ahead }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 + ahead - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** "2026-09" → "September 2026". */
export const monthLabel = (m: string) => monthName.format(new Date(`${m}-01T00:00:00Z`));

export function MonthPicker({ value, onChange, ahead = 0 }: { value: string; onChange: (month: string) => void; ahead?: number }) {
  return (
    <label className="block w-full md:w-48">
      <span className="sr-only">{t("numbers.pickMonth")}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)} data-testid="month-picker">
        {lastMonths(12, new Date(), ahead).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
      </Select>
    </label>
  );
}
