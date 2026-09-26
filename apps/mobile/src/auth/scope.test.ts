import { describe, expect, it } from "vitest";
import type { Membership, Session } from "@gymos/api/auth/session";
import { scopeFor } from "./scope";

const m = (role: Membership["role"], id: string = role): Membership => ({ id, role, branchId: "b", branchName: "B", branchCode: "B", capacity: null, discountAllowancePct: 0 });
const s = (...ms: Membership[]): Session => ({ profile: { id: "p", fullName: "P", email: null, phone: null, preferredLanguage: "en" }, memberships: ms, branches: [] });

describe("mobile scope", () => {
  it("coaches (and head coaches, through their coach membership) get the coach app", () => {
    expect(scopeFor(s(m("coach")))).toMatchObject({ kind: "coach", membership: { id: "coach" } });
    expect(scopeFor(s(m("head_coach"), m("coach", "c2")))).toMatchObject({ kind: "coach", membership: { id: "c2" } });
  });
  it("clients get the client app", () => {
    expect(scopeFor(s(m("client")))).toMatchObject({ kind: "client" });
  });
  it("sales, front desk and top management are sent to the web app", () => {
    for (const r of ["sales_rep", "sales_manager", "front_desk", "top_management"] as const) expect(scopeFor(s(m(r))).kind).toBe("unsupported");
  });
});
