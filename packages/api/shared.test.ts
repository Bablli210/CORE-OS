import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// docs/05 M8: "Shared package has zero React-DOM imports". The lint rule stops new ones; this proves there are none.
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (f === "node_modules") return [];
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts") ? [p] : [];
  });
}

describe("packages/api stays platform-neutral", () => {
  const files = sources(__dirname).map((p) => ({ p, text: readFileSync(p, "utf8") }));
  const imports = (re: RegExp) => files.filter((f) => re.test(f.text)).map((f) => f.p);

  it("has zero React-DOM imports", () => {
    expect(files.length).toBeGreaterThan(40);
    expect(imports(/from\s+["']react-dom(\/[^"']*)?["']|require\(["']react-dom/)).toEqual([]);
  });
  it("imports nothing from Next.js, React Native or Expo", () => {
    expect(imports(/from\s+["'](next|next\/[^"']*|react-native|expo[^"']*|@supabase\/ssr)["']/)).toEqual([]);
  });
});
