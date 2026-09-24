import type { Metadata } from "next";
import { PageHeader } from "@/components/states";
import { SettingsScreen } from "@/features/admin/components/settings-screen";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("settings.title") };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />
      <SettingsScreen />
    </>
  );
}
