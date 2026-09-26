import type { Metadata } from "next";
import { ProgressScreen } from "@/features/training/components/progress-screen";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("progress.title") };

export default function Page() {
  return <ProgressScreen />;
}
