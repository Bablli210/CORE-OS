import type { Metadata, Viewport } from "next";
import { defaultLocale, dir, t } from "@/lib/i18n";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: t("app.name"),
  description: t("app.tagline"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={defaultLocale} dir={dir(defaultLocale)}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
