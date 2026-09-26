/** Week and time math for the schedule and the day (Cairo dates, the gym week starts on Saturday). Weekday 0 = Sunday. */

/** Display order of the gym week: Sat, Sun, Mon, Tue, Wed, Thu, Fri. */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;
export const WEEKDAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Today's date in Cairo as YYYY-MM-DD. */
export function cairoToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const toUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromUtc = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, n: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export const weekdayOf = (iso: string) => toUtc(iso).getUTCDay();

/** The Saturday on or before a date. */
export function weekStart(iso: string): string {
  return addDays(iso, -((weekdayOf(iso) + 1) % 7));
}

/** The date a weekday falls on in the week starting (Saturday) at `start`. */
export function dateInWeek(start: string, weekday: number): string {
  return addDays(start, (weekday + 1) % 7);
}

export const isIsoDate = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtc(s).getTime());

/** "08:00" → 480. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** 480 → "08:00" (1440 → "24:00"). */
export function fromMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Minutes after midnight, in Cairo, of an instant. */
export function cairoMinutes(isoInstant: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(isoInstant));
  return Number(parts.find((p) => p.type === "hour")!.value) * 60 + Number(parts.find((p) => p.type === "minute")!.value);
}

export type Interval = { start: number; end: number };

/** Free gaps inside working hours once the busy intervals are taken out (docs/03 §5: gaps are computed client-side). */
export function freeGaps(working: Interval[], busy: Interval[], minLength = 30): Interval[] {
  const sorted = [...busy].sort((a, b) => a.start - b.start);
  const gaps: Interval[] = [];
  for (const w of [...working].sort((a, b) => a.start - b.start)) {
    let cursor = w.start;
    for (const b of sorted) {
      if (b.end <= cursor || b.start >= w.end) continue;
      if (b.start > cursor) gaps.push({ start: cursor, end: Math.min(b.start, w.end) });
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < w.end) gaps.push({ start: cursor, end: w.end });
  }
  return gaps.filter((g) => g.end - g.start >= minLength);
}

/** Hour rows the week grid shows: working hours and every slot, at least 06:00–22:00, whole hours. */
export function gridHours(ranges: Interval[]): number[] {
  const start = Math.min(6 * 60, ...ranges.map((r) => r.start));
  const end = Math.max(22 * 60, ...ranges.map((r) => r.end));
  const hours: number[] = [];
  for (let h = Math.floor(start / 60); h < Math.ceil(end / 60); h++) hours.push(h);
  return hours;
}

/** Weekdays from onboarding answers (["sat","mon","wed"]) → [6, 1, 3]. */
export function prefWeekdays(days: unknown): number[] {
  if (!Array.isArray(days)) return [];
  return days.map((d) => WEEKDAY_CODES.indexOf(String(d).toLowerCase().slice(0, 3) as (typeof WEEKDAY_CODES)[number])).filter((d) => d >= 0);
}

/** A Cairo wall-clock date and time ("2026-09-26", "08:00") → the instant, as ISO (handles Egypt's summer time). */
export function cairoInstant(date: string, time: string): string {
  const naive = Date.parse(`${date}T${time}:00Z`);
  const offsetAt = (instant: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(new Date(instant))
        .map((x) => [x.type, x.value]),
    );
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute)) - instant;
  };
  let t = naive - offsetAt(naive);
  t = naive - offsetAt(t);
  return new Date(t).toISOString();
}

/**
 * Side-by-side lanes for blocks that overlap in time (two clients booked in the same hour), so the week grid draws them
 * next to each other instead of on top of each other. Blocks that overlap directly or through a chain share one
 * cluster; each gets the first free lane, and every block in a cluster is split into the cluster's lane count.
 */
export function laneLayout<T extends { id: string; start: number; end: number }>(blocks: T[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id));
  const out = new Map<string, { lane: number; lanes: number }>();
  let cluster: string[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    for (const id of cluster) out.set(id, { lane: out.get(id)!.lane, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };
  for (const b of sorted) {
    if (b.start >= clusterEnd) close();
    let lane = laneEnds.findIndex((end) => end <= b.start);
    if (lane < 0) lane = laneEnds.push(b.end) - 1;
    else laneEnds[lane] = b.end;
    out.set(b.id, { lane, lanes: 0 });
    cluster.push(b.id);
    clusterEnd = Math.max(clusterEnd, b.end);
  }
  close();
  return out;
}
