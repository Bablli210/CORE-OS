import type { MetadataRoute } from "next";
import { t } from "@/lib/i18n";
import { PWA_BACKGROUND, PWA_THEME } from "@/lib/pwa";

/** Installable PWA (docs/05 M5). Members land on /, which routes them to /c. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: t("app.name"),
    short_name: t("app.name"),
    description: t("app.tagline"),
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: PWA_BACKGROUND,
    theme_color: PWA_THEME,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
