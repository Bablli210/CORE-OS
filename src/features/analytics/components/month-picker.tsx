"use client";

import { Select } from "@/components/ui/input";
import { cairoMonth } from "@/lib/format";
import { t } from "@/lib/i18n";

/** The last 12 months (the views keep 12), newest first. */
export function lastMonths(n = 12, now = new Date()): string[] {
  const [y, m] = cairoMonth(now).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export function MonthPicker({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  return (
    <label className="block w-full md:w-48">
      <span className="sr-only">{t("numbers.pickMonth")}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)} data-testid="month-picker">
        {lastMonths().map((m) => <option key={m} value={m}>{label.format(new Date(`${m}-01T00:00:00Z`))}</option>)}
      </Select>
    </label>
  );
}
