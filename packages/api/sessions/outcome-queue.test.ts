import { describe, expect, it } from "vitest";
import { isNetworkError } from "./errors";
import { applyOutcome, dequeue, enqueue, readQueue, withQueued, writeQueue, type QueuedOutcome } from "./outcome-queue";
import type { CoachDay, DaySession } from "./coach";

const session = (id: string, over: Partial<DaySession> = {}): DaySession => ({
  id,
  starts_at: "2026-09-26T05:00:00Z",
  duration_minutes: 60,
  client_id: "c1",
  client_name: "Client",
  status: "booked",
  credits_left: 2,
  unpaid: false,
  waived: false,
  is_walk_in: false,
  credit_consumed: false,
  slot_id: null,
  injuries: null,
  at_risk: false,
  late: false,
  pending_approval: false,
  ...over,
});
const day = (sessions: DaySession[]): CoachDay => ({
  date: "2026-09-26",
  today: "2026-09-26",
  coach: { membership_id: "m1", name: "Sara", branch_id: "b" },
  can_record: true,
  can_edit_late: false,
  edit_window_hours: 24,
  availability: [],
  sessions,
  blocks: [],
  follow_ups: [],
});

describe("optimistic outcome", () => {
  it("completed burns one session with this coach, for every row of the client", () => {
    const d = applyOutcome(day([session("s1"), session("s2")]), "s1", "completed");
    expect(d.sessions[0]).toMatchObject({ status: "completed", credit_consumed: true, credits_left: 1 });
    expect(d.sessions[1].credits_left).toBe(1);
  });

  it("completed on zero sessions left is unpaid, nothing burns", () => {
    const d = applyOutcome(day([session("s1", { credits_left: 0 })]), "s1", "completed");
    expect(d.sessions[0]).toMatchObject({ status: "completed", unpaid: true, credits_left: 0, credit_consumed: false });
  });

  it("changing completed to cancelled gives the session back", () => {
    const d = applyOutcome(day([session("s1", { status: "completed", credit_consumed: true, credits_left: 1 })]), "s1", "cancelled");
    expect(d.sessions[0]).toMatchObject({ status: "cancelled", credit_consumed: false, credits_left: 2 });
  });

  it("no-show deducts nothing", () => {
    expect(applyOutcome(day([session("s1")]), "s1", "no_show").sessions[0]).toMatchObject({ status: "no_show", credits_left: 2 });
  });

  it("the same outcome twice changes nothing", () => {
    const d = day([session("s1", { status: "completed", credit_consumed: true })]);
    expect(applyOutcome(d, "s1", "completed")).toBe(d);
  });
});

describe("retry queue", () => {
  const item = (sessionId: string, outcome: QueuedOutcome["outcome"]): QueuedOutcome => ({ sessionId, outcome, coach: "m1", date: "2026-09-26", queuedAt: "t" });

  it("keeps the latest tap per session, in first-tap order", () => {
    const q = enqueue(enqueue(enqueue([], item("a", "completed")), item("b", "no_show")), item("a", "cancelled"));
    expect(q.map((x) => `${x.sessionId}:${x.outcome}`)).toEqual(["a:cancelled", "b:no_show"]);
  });

  it("dequeues only the outcome that was saved (a newer tap stays)", () => {
    const q = [item("a", "cancelled")];
    expect(dequeue(q, "a", "completed")).toHaveLength(1);
    expect(dequeue(q, "a", "cancelled")).toHaveLength(0);
  });

  it("survives a reload and ignores garbage", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    writeQueue(storage, [item("a", "completed")]);
    expect(readQueue(storage)).toHaveLength(1);
    store.set("gymos.outcomes.v1", "{not json");
    expect(readQueue(storage)).toEqual([]);
  });

  it("lays queued taps over the server's day for that coach and date only", () => {
    const d = withQueued(day([session("s1")]), [item("s1", "completed"), { ...item("s1", "no_show"), coach: "other" }]);
    expect(d.sessions[0].status).toBe("completed");
  });
});

describe("network vs database errors", () => {
  it("retries fetch failures, rolls back database answers", () => {
    expect(isNetworkError({ message: "TypeError: Failed to fetch", code: "" })).toBe(true);
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError({ message: "not allowed", code: "42501" })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
