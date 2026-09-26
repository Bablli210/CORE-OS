import { defineConfig } from "vitest/config";

// Root tests: the Edge Functions' shared code (plain TypeScript, no Deno globals). The apps and packages run their own.
export default defineConfig({
  test: { environment: "node", include: ["supabase/functions/_shared/**/*.test.ts"] },
});
