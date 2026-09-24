/** Display helpers. All business times are shown in Cairo (CLAUDE.md). Money is stored in piastres. */
const TZ = "Africa/Cairo";

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: TZ });
const dateOnly = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: TZ });
const timeOnly = new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: TZ });
const egp = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));
export const formatTime = (iso: string) => timeOnly.format(new Date(iso));
export const formatEGP = (piastres: number) => egp.format(piastres / 100);

/** Whole days between an instant and now (0 = today). */
export function daysSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

/** Compact duration: "45m", "3h", "2d". Always positive; the caller says whether it is ahead or behind. */
export function shortDuration(ms: number): string {
  const m = Math.round(Math.abs(ms) / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** YYYY-MM of an instant in Cairo (targets and dashboards are keyed by it). */
export function cairoMonth(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(date);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}
