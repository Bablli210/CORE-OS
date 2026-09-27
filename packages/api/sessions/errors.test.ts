import { describe, expect, it } from "vitest";
import { t } from "@gymos/i18n";
import { coachingErrorKey, failedWeekday } from "./errors";

const db = (message: string, code = "23514", details: string | null = null) => ({ message, code, details, hint: null });

describe("schedule refusals (shared hours, docs/06 #20)", () => {
  it("names a Blocked hour, a Blocked hour over a slot, and the same client twice", () => {
    expect(coachingErrorKey(db("overlaps a blocked hour on that day"))).toBe("schedule.error.blocked");
    expect(coachingErrorKey(db("Sun: overlaps a blocked hour on that day", "23514", "0"))).toBe("schedule.error.blocked");
    expect(coachingErrorKey(db("a blocked hour cannot overlap another slot on that day"))).toBe("schedule.error.blockedOver");
    expect(coachingErrorKey(db("client already has a slot at that time"))).toBe("schedule.error.clientBusy");
    expect(coachingErrorKey(db("client already has a session at that time"))).toBe("schedule.error.clientBusy");
    expect(coachingErrorKey(db("client has no credits with this coach", "GY001"))).toBe("schedule.error.noCredits");
  });

  it("each says what to do next", () => {
    expect(t("schedule.error.blocked")).toBe("that hour is blocked. Pick another time or end the blocked hour.");
    expect(t("schedule.error.clientBusy")).toContain("Pick another time");
    expect(t("schedule.error.blockedOver")).toContain("move or end that slot");
  });

  it("reads the failing weekday from DETAIL", () => {
    expect(failedWeekday(db("Sun: overlaps a blocked hour on that day", "23514", "0"))).toBe(0);
    expect(failedWeekday(db("client already has a slot at that time"))).toBeNull();
  });
});
