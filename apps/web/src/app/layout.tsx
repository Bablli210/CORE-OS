import type { Metadata, Viewport } from "next";
import { defaultLocale, dir, t } from "@gymos/i18n";
import { PWA_THEME } from "@/lib/pwa";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: t("app.name"),
  description: t("app.tagline"),
  applicationName: t("app.name"),
  appleWebApp: { capable: true, title: t("app.name"), statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={defaultLocale} dir={dir(defaultLocale)}>
      {/* In <head> on purpose: Next 15 streams generated metadata into <body> for browsers, where Chrome ignores the
          manifest link — the app would not be installable. */}
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content={PWA_THEME} />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
