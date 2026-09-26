import { describe, expect, it } from "vitest";
import { hasMessage } from "@gymos/i18n";
import { GUIDES } from "./guides";

describe("first-run guides", () => {
  it("give every role a short guide whose words are all written", () => {
    for (const [role, g] of Object.entries(GUIDES)) {
      expect(g.steps.length, role).toBeGreaterThanOrEqual(3);
      expect(g.steps.length, role).toBeLessThanOrEqual(5);
      expect(new Set(g.steps.map((s) => s.id)).size, role).toBe(g.steps.length);
      for (const key of [g.title, g.intro, ...g.steps.flatMap((s) => [s.title, s.body])]) expect(hasMessage(key), `${role}: ${key}`).toBe(true);
      for (const s of g.steps) expect(s.href.startsWith("/"), `${role}: ${s.href}`).toBe(true);
    }
  });
});
