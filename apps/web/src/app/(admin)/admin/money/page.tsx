import type { Metadata } from "next";
import { PageHeader } from "@/components/states";
import { MoneyScreen } from "@/features/admin/components/money-screen";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("screen.admin.money.title") };

export default function MoneyPage() {
  return (
    <>
      <PageHeader title={t("screen.admin.money.title")} description={t("screen.admin.money.job")} />
      <MoneyScreen />
    </>
  );
}
