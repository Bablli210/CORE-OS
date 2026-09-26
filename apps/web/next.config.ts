import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import path from "node:path";

// PWA (docs/05 M5): Serwist builds src/app/sw.ts into public/sw.js and registers it. Off in `next dev` so
// development always hits the network; `pnpm build && pnpm start` (and the e2e suite) run with it.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

// pnpm workspace (M8): trace files from the repo root so shared packages are included in the server build.
// The shared packages ship TypeScript source; Next compiles them with the app.
const nextConfig: NextConfig = { outputFileTracingRoot: path.join(__dirname, "../.."), transpilePackages: ["@gymos/api", "@gymos/i18n"] };

export default withSerwist(nextConfig);
