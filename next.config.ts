import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

// PWA (docs/05 M5): Serwist builds src/app/sw.ts into public/sw.js and registers it. Off in `next dev` so
// development always hits the network; `pnpm build && pnpm start` (and the e2e suite) run with it.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {};

export default withSerwist(nextConfig);
