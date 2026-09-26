import { describe, expect, it } from "vitest";
import { activeHref, navFor, splitForBottomBar } from "./nav";

describe("navigation per role (docs/04)", () => {
  it("gives the head coach a Team tab and the coach none", () => {
    expect(navFor("head_coach").primary.map((i) => i.href)).toContain("/coach/team");
    expect(navFor("coach").primary.map((i) => i.href)).not.toContain("/coach/team");
  });

  it("puts My week in the coach's bottom bar, next to Today", () => {
    expect(navFor("coach").primary.map((i) => i.href).slice(0, 2)).toEqual(["/coach", "/coach/schedule"]);
    expect(splitForBottomBar(navFor("coach").primary).overflow).toHaveLength(0);
  });

  it("gives the sales manager Queue and Team on top of the rep tabs", () => {
    const rep = navFor("sales_rep").primary.map((i) => i.href);
    const manager = navFor("sales_manager").primary.map((i) => i.href);
    expect(rep).toEqual(["/sales", "/sales/pipeline", "/sales/leads", "/sales/deals", "/sales/numbers"]);
    expect(manager).toEqual([...rep, "/sales/queue", "/sales/team"]);
  });

  it("keeps the bottom bar at 5 slots with a More overflow", () => {
    const { visible, overflow } = splitForBottomBar(navFor("top_management").primary);
    expect(visible).toHaveLength(4);
    expect(overflow).toHaveLength(6);
    expect(splitForBottomBar(navFor("client").primary).overflow).toHaveLength(0);
  });

  it("highlights the owning tab for nested pages", () => {
    const items = navFor("sales_rep").primary;
    expect(activeHref(items, "/sales")).toBe("/sales");
    expect(activeHref(items, "/sales/leads/42")).toBe("/sales/leads");
    expect(activeHref(items, "/sales/unknown")).toBeNull();
  });
});
