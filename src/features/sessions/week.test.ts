import { describe, expect, it } from "vitest";
import { addDays, cairoInstant, cairoMinutes, cairoToday, dateInWeek, freeGaps, fromMinutes, gridHours, isIsoDate, prefWeekdays, toMinutes, weekStart, weekdayOf } from "./week";

describe("week math", () => {
  it("the gym week starts on Saturday", () => {
    expect(weekStart("2026-09-26")).toBe("2026-09-26"); // Saturday
    expect(weekStart("2026-09-25")).toBe("2026-09-19"); // Friday → previous Saturday
    expect(weekStart("2026-09-27")).toBe("2026-09-26"); // Sunday
  });

  it("places weekdays in a week", () => {
    expect(dateInWeek("2026-09-26", 6)).toBe("2026-09-26");
    expect(dateInWeek("2026-09-26", 1)).toBe("2026-09-28");
    expect(dateInWeek("2026-09-26", 5)).toBe("2026-10-02");
    expect(weekdayOf("2026-09-28")).toBe(1);
  });

  it("adds days across months", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("uses Cairo dates and times", () => {
    expect(cairoToday(new Date("2026-09-24T22:30:00Z"))).toBe("2026-09-25"); // 01:30 in Cairo (UTC+3)
    expect(cairoMinutes("2026-09-26T05:00:00Z")).toBe(8 * 60);
  });

  it("turns Cairo wall-clock time into an instant, summer and winter", () => {
    expect(cairoInstant("2026-09-26", "08:00")).toBe("2026-09-26T05:00:00.000Z"); // UTC+3
    expect(cairoInstant("2026-12-05", "08:00")).toBe("2026-12-05T06:00:00.000Z"); // UTC+2
  });

  it("converts times", () => {
    expect(toMinutes("08:30")).toBe(510);
    expect(fromMinutes(510)).toBe("08:30");
    expect(fromMinutes(1440)).toBe("24:00");
  });

  it("validates dates from the URL", () => {
    expect(isIsoDate("2026-09-26")).toBe(true);
    expect(isIsoDate("26/09/2026")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe("free gaps and grid", () => {
  it("takes busy time out of working hours", () => {
    const gaps = freeGaps([{ start: 360, end: 840 }], [{ start: 420, end: 480 }, { start: 480, end: 540 }, { start: 600, end: 660 }]);
    expect(gaps).toEqual([{ start: 360, end: 420 }, { start: 540, end: 600 }, { start: 660, end: 840 }]);
  });

  it("drops gaps shorter than the minimum", () => {
    expect(freeGaps([{ start: 360, end: 400 }], [{ start: 370, end: 390 }])).toEqual([]);
  });

  it("shows at least 06:00–22:00 and stretches for late slots", () => {
    expect(gridHours([])).toEqual(Array.from({ length: 16 }, (_, i) => 6 + i));
    expect(gridHours([{ start: 22 * 60, end: 23 * 60 + 30 }]).at(-1)).toBe(23);
  });

  it("reads preferred days from onboarding", () => {
    expect(prefWeekdays(["sat", "mon", "wed"])).toEqual([6, 1, 3]);
    expect(prefWeekdays("nope")).toEqual([]);
  });
});
