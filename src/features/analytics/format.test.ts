import { describe, expect, it } from "vitest";
import { formatMetric, progressPct, rowsUnit } from "./format";

describe("metric formatting", () => {
  it("formats each unit", () => {
    expect(formatMetric("count", 1284)).toBe("1,284");
    expect(formatMetric("count", 12_900, { compact: true })).toBe("12.9K");
    expect(formatMetric("pct", 10.6)).toBe("10.6%");
    expect(formatMetric("minutes", 45)).toBe("45m");
    expect(formatMetric("minutes", 185)).toBe("3.1h");
    expect(formatMetric("money", 552000)).toMatch(/5,520/);
    expect(formatMetric("count", null)).toBe("—");
  });

  it("computes progress against a target only when there is one", () => {
    expect(progressPct(60, 80)).toBe(75);
    expect(progressPct(120, 80)).toBe(150);
    expect(progressPct(5, null)).toBeNull();
    expect(progressPct(5, 0)).toBeNull();
  });

  it("knows the unit behind a metric's rows", () => {
    expect(rowsUnit("admin.booked")).toBe("money");
    expect(rowsUnit("coach.commission")).toBe("money");
    expect(rowsUnit("coach.no_show_pct")).toBe("pct");
    expect(rowsUnit("rep.conversion")).toBe("pct");
    expect(rowsUnit("sales.response")).toBe("minutes");
    expect(rowsUnit("coach.burned")).toBe("count");
  });
});
