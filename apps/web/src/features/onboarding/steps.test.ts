import { describe, expect, it } from "vitest";
import { activeSteps, initialAnswers, missingFields, resumeIndex, STEPS } from "./steps";

const step = (key: string) => STEPS.find((s) => s.key === key)!;

describe("onboarding wizard steps (docs/03 §2 schema v1)", () => {
  it("has at most 7 question screens", () => {
    expect(STEPS.length).toBeLessThanOrEqual(7);
  });

  it("skips PT preferences when the lead is not interested in PT", () => {
    expect(activeSteps({ interest: { pt: "no" } }).map((s) => s.key)).not.toContain("pt_prefs");
    expect(activeSteps({ interest: { pt: "maybe" } }).map((s) => s.key)).toContain("pt_prefs");
  });

  it("resumes at the first unsaved step (refresh keeps progress)", () => {
    expect(resumeIndex({})).toBe(0);
    expect(activeSteps({ identity: {}, goal: {}, interest: { pt: "yes" } })[resumeIndex({ identity: {}, goal: {}, interest: { pt: "yes" } })].key).toBe("pt_prefs");
    const noPt = { identity: {}, goal: {}, interest: { pt: "no" } };
    expect(activeSteps(noPt)[resumeIndex(noPt)].key).toBe("health");
  });

  it("requires the health acknowledgement and every PAR-Q answer", () => {
    const partial = { medical_clearance: true, parq: { q1: false }, acknowledged: false };
    expect(missingFields(step("health"), partial)).toEqual(["parq", "acknowledged"]);
    const full = { medical_clearance: false, parq: Object.fromEntries(["q1", "q2", "q3", "q4", "q5", "q6", "q7"].map((q) => [q, false])), acknowledged: true };
    expect(missingFields(step("health"), full)).toEqual([]);
  });

  it("prefills the name and how they heard about us", () => {
    expect(initialAnswers(step("identity"), {}, { full_name: "Noha Sami" }).full_name).toBe("Noha Sami");
    expect(initialAnswers(step("social"), {}, { heard_from: "instagram" }).heard_from).toBe("instagram");
    expect(initialAnswers(step("goal"), { goal: { primary: "muscle" } }, {})).toEqual({ primary: "muscle" });
  });
});
