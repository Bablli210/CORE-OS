import type { CoachDay, DaySession, Outcome } from "./queries/coach";

/**
 * Attendance taps that could not reach the server (no signal in the gym) wait here and are replayed in order.
 * Kept in localStorage so a closed tab or a reload does not lose them. Pure functions; the hook wires them up.
 */
export type QueuedOutcome = { sessionId: string; outcome: Outcome; coach: string; date: string; queuedAt: string };

const KEY = "gymos.outcomes.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readQueue(storage: StorageLike | null): QueuedOutcome[] {
  try {
    const raw = storage?.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as QueuedOutcome[]).filter((q) => q && typeof q.sessionId === "string" && typeof q.outcome === "string") : [];
  } catch {
    return [];
  }
}

export function writeQueue(storage: StorageLike | null, queue: QueuedOutcome[]) {
  try {
    storage?.setItem(KEY, JSON.stringify(queue));
  } catch {
    /* storage full or blocked: the tap still shows; it just won't survive a reload */
  }
}

/** The latest tap for a session wins; order of first tap is kept for replay. */
export function enqueue(queue: QueuedOutcome[], item: QueuedOutcome): QueuedOutcome[] {
  const i = queue.findIndex((q) => q.sessionId === item.sessionId);
  if (i === -1) return [...queue, item];
  const next = [...queue];
  next[i] = item;
  return next;
}

export const dequeue = (queue: QueuedOutcome[], sessionId: string, outcome?: Outcome) =>
  queue.filter((q) => !(q.sessionId === sessionId && (outcome === undefined || q.outcome === outcome)));

/**
 * What the day looks like right after a tap, before the server answers: the new status, and the sessions left with this coach
 * moved the way fn_record_attendance will move them (completed burns one if any are left, else it is unpaid; leaving
 * completed gives it back). The server's answer replaces this.
 */
export function applyOutcome(day: CoachDay, sessionId: string, outcome: Outcome): CoachDay {
  const s = day.sessions.find((x) => x.id === sessionId);
  if (!s || s.status === outcome) return day;
  let delta = 0;
  let patch: Partial<DaySession> = { status: outcome };
  if (outcome === "completed" && !s.credit_consumed) {
    if (s.credits_left > 0) {
      delta = -1;
      patch = { ...patch, credit_consumed: true, unpaid: false };
    } else {
      patch = { ...patch, unpaid: true };
    }
  } else if (outcome !== "completed" && s.credit_consumed) {
    delta = 1;
    patch = { ...patch, credit_consumed: false };
  } else if (outcome !== "completed" && s.unpaid) {
    patch = { ...patch, unpaid: false };
  }
  return {
    ...day,
    sessions: day.sessions.map((x) =>
      x.id === sessionId ? { ...x, ...patch, credits_left: x.credits_left + delta } : x.client_id === s.client_id ? { ...x, credits_left: x.credits_left + delta } : x,
    ),
  };
}

/** The server's day with this coach's queued taps for that date laid on top. */
export function withQueued(day: CoachDay, queue: QueuedOutcome[]): CoachDay {
  return queue.filter((q) => q.coach === day.coach.membership_id && q.date === day.date).reduce((d, q) => applyOutcome(d, q.sessionId, q.outcome), day);
}
