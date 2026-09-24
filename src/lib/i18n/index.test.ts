import { describe, expect, it } from "vitest";
import { dir, t } from "./index";

describe("t()", () => {
  it("returns the English string for a key", () => {
    expect(t("app.name")).toBe("GymOS");
  });

  it("falls back to English when Arabic has no translation yet", () => {
    expect(t("app.name", undefined, "ar")).toBe("GymOS");
  });

  it("marks Arabic as right-to-left", () => {
    expect(dir("ar")).toBe("rtl");
    expect(dir("en")).toBe("ltr");
  });
});
