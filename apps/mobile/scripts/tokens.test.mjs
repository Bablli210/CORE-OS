import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generate, OUT_PATH } from "./tokens.mjs";

describe("mobile tokens", () => {
  it("are generated from the web's tokens.css and up to date (run `pnpm --filter @gymos/mobile tokens`)", () => {
    expect(readFileSync(OUT_PATH, "utf8")).toBe(generate());
  });
  it("convert oklch to the expected sRGB hex", () => {
    const semantic = ["card", "card-foreground", "primary", "primary-foreground", "secondary", "secondary-foreground", "muted", "muted-foreground", "accent", "accent-foreground", "destructive", "destructive-foreground", "border", "input", "ring", "success", "success-foreground", "warning", "warning-foreground", "info", "info-foreground"];
    const css = `:root { --n: oklch(1 0 0); --k: oklch(0 0 0); --background: var(--n); --foreground: var(--k); --space-unit: 0.25rem; --radius: 0.625rem; ${semantic.map((k) => `--${k}: var(--n);`).join(" ")} }`;
    const out = generate(css);
    expect(out).toContain('"background": "#ffffff"');
    expect(out).toContain('"foreground": "#000000"');
  });
});
