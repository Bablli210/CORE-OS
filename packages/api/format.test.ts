import { describe, expect, it } from "vitest";
import { cairoMonth, daysSince, formatEGP, shortDuration } from "./format";
import { whatsappLink } from "./contact-links";

describe("format helpers", () => {
  it("shows piastres as EGP", () => {
    expect(formatEGP(540000)).toMatch(/5,400/);
  });
  it("uses Cairo for the month boundary", () => {
    expect(cairoMonth(new Date("2026-09-30T22:30:00Z"))).toBe("2026-10"); // 01:30 on 1 Oct in Cairo (UTC+3)
  });
  it("counts whole days and compact durations", () => {
    const now = Date.parse("2026-09-24T12:00:00Z");
    expect(daysSince("2026-09-21T11:00:00Z", now)).toBe(3);
    expect(shortDuration(45 * 60_000)).toBe("45m");
    expect(shortDuration(5 * 3_600_000)).toBe("5h");
    expect(shortDuration(3 * 86_400_000)).toBe("3d");
  });
  it("builds wa.me links from E.164", () => {
    expect(whatsappLink("+201011112222", "hi there")).toBe("https://wa.me/201011112222?text=hi%20there");
  });
});
