import type { Metadata, Viewport } from "next";
import { Wizard } from "@/features/onboarding/components/wizard";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("wizard.title"), robots: { index: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

/** Public onboarding wizard (signed token, no login). docs/04 /onboard/[token]. */
export default async function OnboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6">
      <p className="mb-4 text-sm font-semibold text-muted-foreground">{t("app.name")}</p>
      <Wizard token={token} />
    </main>
  );
}
