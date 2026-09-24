import type { Json } from "@/lib/database.types";
import type { MessageKey } from "@/lib/i18n";

export type SettingRow = { key: string; value: Json; description: string | null; updated_at: string };
export type SettingKind = "boolean" | "number" | "text" | "tiers" | "json";
export type Tier = { upTo: number | null; pct: number };

/** docs/04 /admin/settings groups (Sales, Deals, Payments, Credits, Attendance, Scheduling, Commission, Risk, Freeze) + Other. */
const GROUPS: { id: string; label: MessageKey; prefixes: string[] }[] = [
  { id: "sales", label: "settings.group.sales", prefixes: ["sales", "leads", "attribution"] },
  { id: "deals", label: "settings.group.deals", prefixes: ["deals"] },
  { id: "payments", label: "settings.group.payments", prefixes: ["payments"] },
  { id: "credits", label: "settings.group.credits", prefixes: ["credits"] },
  { id: "attendance", label: "settings.group.attendance", prefixes: ["attendance"] },
  { id: "scheduling", label: "settings.group.scheduling", prefixes: ["scheduling", "coaching", "nutrition"] },
  { id: "commission", label: "settings.group.commission", prefixes: ["commission"] },
  { id: "risk", label: "settings.group.risk", prefixes: ["risk"] },
  { id: "freeze", label: "settings.group.freeze", prefixes: ["freeze"] },
  { id: "other", label: "settings.group.other", prefixes: [] },
];

export function groupSettings(rows: SettingRow[]): { id: string; label: MessageKey; rows: SettingRow[] }[] {
  const groupOf = (key: string) => GROUPS.find((g) => g.prefixes.includes(key.split(".")[0])) ?? GROUPS[GROUPS.length - 1];
  return GROUPS.map((g) => ({ id: g.id, label: g.label, rows: rows.filter((r) => groupOf(r.key).id === g.id).sort((a, b) => a.key.localeCompare(b.key)) })).filter(
    (g) => g.rows.length > 0,
  );
}

export function settingKind(key: string, value: Json): SettingKind {
  if (key === "commission.pt_tiers") return "tiers";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "text";
  return "json";
}

/** "attendance.edit_window_hours" → "Edit window hours" */
export function humanizeKey(key: string): string {
  const last = key.split(".").slice(1).join(" ") || key;
  const words = last.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function parseTiers(value: Json): Tier[] {
  if (!Array.isArray(value)) return [];
  return value.map((t) => {
    const o = (t ?? {}) as { up_to?: number | null; pct?: number };
    return { upTo: typeof o.up_to === "number" ? o.up_to : null, pct: Number(o.pct ?? 0) };
  });
}

export function serializeTiers(tiers: Tier[]): Json {
  return tiers.map((t, i) => ({ up_to: i === tiers.length - 1 ? null : t.upTo, pct: t.pct }));
}

/** Mirrors fn_update_setting: ascending whole-number limits, last tier open-ended, 0–100%. Returns an error key or null. */
export function validateTiers(tiers: Tier[]): MessageKey | null {
  if (tiers.length === 0) return "settings.tiers.errorEmpty";
  let prev = 0;
  for (let i = 0; i < tiers.length; i++) {
    const { upTo, pct } = tiers[i];
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return "settings.tiers.errorPct";
    if (i < tiers.length - 1) {
      if (upTo === null || !Number.isInteger(upTo) || upTo <= prev) return "settings.tiers.errorOrder";
      prev = upTo;
    }
  }
  return null;
}
