// Renders the PWA icons (public/icons/*.png) with the installed Chromium. Neutral placeholder until branding:
// the tokens' --primary (neutral-900) background and --background (neutral-0) letter. Run: node scripts/make-icons.mjs
import { chromium } from "@playwright/test";

const BG = "#171717";
const FG = "#ffffff";
const icons = [
  { file: "icon-192.png", size: 192, radius: 0.22, scale: 0.62 },
  { file: "icon-512.png", size: 512, radius: 0.22, scale: 0.62 },
  { file: "icon-maskable-512.png", size: 512, radius: 0, scale: 0.46 }, // maskable: full bleed, letter inside the safe zone
  { file: "apple-touch-icon.png", size: 180, radius: 0, scale: 0.6 },
];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const i of icons) {
  await page.setViewportSize({ width: i.size, height: i.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">
    <div style="width:${i.size}px;height:${i.size}px;background:${BG};border-radius:${i.radius * i.size}px;display:grid;place-items:center;
      font:700 ${Math.round(i.size * i.scale)}px/1 system-ui,sans-serif;color:${FG}">G</div></body></html>`);
  await page.screenshot({ path: `public/icons/${i.file}`, omitBackground: true });
}
await browser.close();
