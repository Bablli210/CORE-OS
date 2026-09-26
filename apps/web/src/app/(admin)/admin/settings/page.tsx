import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/states";
import { SettingsTabs } from "@/features/admin/components/settings-tabs";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("settings.title") };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />
      <Suspense>
        <SettingsTabs />
      </Suspense>
    </>
  );
}
