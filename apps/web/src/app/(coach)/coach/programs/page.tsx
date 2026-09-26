import type { Metadata } from "next";
import { TemplatesScreen } from "@/features/programs/components/templates-screen";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("templates.title") };

export default function Page() {
  return <TemplatesScreen />;
}
