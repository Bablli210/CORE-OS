import { describe, expect, it } from "vitest";
import { egpToPiastres } from "./labels";

describe("EGP input", () => {
  it("turns typed EGP into piastres (the only unit the database takes)", () => {
    expect(egpToPiastres("2760")).toBe(276000);
    expect(egpToPiastres("1,500.50")).toBe(150050);
    expect(egpToPiastres("")).toBe(0);
    expect(egpToPiastres("abc")).toBeNull();
    expect(egpToPiastres("-5")).toBeNull();
  });
});
