import type { Metadata } from "next";
import { CreditsScreen } from "@/features/training/components/credits-screen";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("credits.screenTitle") };

export default function Page() {
  return <CreditsScreen />;
}
