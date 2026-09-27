import { afterEach, describe, expect, it } from "vitest";
import { configureClient, type Db } from "../supabase";
import { fetchDay, type CoachDay, type DaySession } from "./coach";

const session = (id: string, starts_at: string, client_name: string): DaySession => ({
  id,
  starts_at,
  duration_minutes: 60,
  client_id: `c-${id}`,
  client_name,
  status: "booked",
  credits_left: 3,
  unpaid: false,
  waived: false,
  is_walk_in: false,
  credit_consumed: false,
  slot_id: null,
  injuries: null,
  at_risk: false,
  late: false,
  pending_approval: false,
});

const day = (sessions: DaySession[]): CoachDay => ({
  date: "2026-09-27",
  today: "2026-09-27",
  coach: { membership_id: "m", name: "Sara", branch_id: "b" },
  can_record: true,
  can_edit_late: false,
  edit_window_hours: 48,
  availability: [],
  sessions,
  blocks: [],
  follow_ups: [],
});

/** A stand-in client whose fn_coach_today returns the sessions in the order given (the database's order is not fixed). */
const serve = (sessions: DaySession[]) => configureClient(() => ({ rpc: async () => ({ data: day(sessions), error: null }) }) as unknown as Db);

describe("fetchDay (shared hours, docs/06 #20)", () => {
  afterEach(() => configureClient(() => { throw new Error("not configured"); }));

  it("orders clients sharing an hour by time, then name, then id, whatever order the database returns", async () => {
    const at8 = "2026-09-27T05:00:00Z";
    const at9 = "2026-09-27T06:00:00Z";
    const rows = [session("s3", at9, "Aya"), session("s2", at8, "Mostafa"), session("s1", at8, "Aya"), session("s0", at8, "Aya")];
    serve(rows);
    const first = await fetchDay("m", "2026-09-27");
    expect(first.sessions.map((s) => s.id)).toEqual(["s0", "s1", "s2", "s3"]);

    // after an outcome the database may return the rows swapped; the order the coach sees does not change
    serve([...rows].reverse());
    const again = await fetchDay("m", "2026-09-27");
    expect(again.sessions.map((s) => s.id)).toEqual(["s0", "s1", "s2", "s3"]);
  });
});
