import { defineConfig } from "vitest/config";

// Unit tests for the phone's pure pieces (tokens, platform adapters). Screens are covered by the e2e suite on the web build.
export default defineConfig({ test: { environment: "node", include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"] } });
