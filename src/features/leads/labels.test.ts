import { describe, expect, it } from "vitest";
import { allowedMoves } from "./labels";

describe("pipeline moves (docs/03 §1)", () => {
  it("moves only forward, or to lost", () => {
    expect(allowedMoves("new")).toEqual(["contacted", "onboarded", "quoted", "lost"]);
    expect(allowedMoves("onboarded")).toEqual(["quoted", "lost"]);
    expect(allowedMoves("quoted")).toEqual(["lost"]);
  });
  it("offers nothing once won or lost (won is set by payment)", () => {
    expect(allowedMoves("won")).toEqual([]);
    expect(allowedMoves("lost")).toEqual([]);
  });
});
