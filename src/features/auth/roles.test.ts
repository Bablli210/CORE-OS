import { describe, expect, it } from "vitest";
import { areaForPath, homeFor, resolveContext, type MembershipContext } from "./roles";

const m = (id: string, role: MembershipContext["role"], branchName: string | null = "Branch A"): MembershipContext => ({ id, role, branchId: branchName, branchName });

describe("role routing", () => {
  it("sends each role to its home (docs/05 M1)", () => {
    expect(homeFor({ role: "client" })).toBe("/c");
    expect(homeFor({ role: "coach" })).toBe("/coach");
    expect(homeFor({ role: "head_coach" })).toBe("/coach");
    expect(homeFor({ role: "sales_rep" })).toBe("/sales");
    expect(homeFor({ role: "sales_manager" })).toBe("/sales");
    expect(homeFor({ role: "front_desk" })).toBe("/sales");
    expect(homeFor({ role: "top_management" })).toBe("/admin");
  });

  it("defaults a head coach to the head coach role so Team shows", () => {
    const ahmed = [m("coach", "coach"), m("head", "head_coach")];
    expect(resolveContext(ahmed)?.id).toBe("head");
  });

  it("remembers the last used membership within the area", () => {
    const karim = [m("a", "sales_manager", "Branch A"), m("b", "sales_manager", "Branch B")];
    expect(resolveContext(karim, "sales", "b")?.id).toBe("b");
    expect(resolveContext(karim, "sales", null)?.id).toBe("a");
  });

  it("ignores a remembered membership from another area", () => {
    const multi = [m("rep", "sales_rep"), m("coach", "coach")];
    expect(resolveContext(multi, "coach", "rep")?.id).toBe("coach");
    expect(resolveContext(multi, "admin", "rep")).toBeNull();
  });

  it("maps paths to areas", () => {
    expect(areaForPath("/c")).toBe("client");
    expect(areaForPath("/coach/team")).toBe("coach");
    expect(areaForPath("/sales/leads/1")).toBe("sales");
    expect(areaForPath("/admin/people")).toBe("admin");
    expect(areaForPath("/notifications")).toBeNull();
    expect(areaForPath("/checkin")).toBeNull();
  });
});
