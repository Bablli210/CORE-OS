import type { Metadata } from "next";
import { PageHeader } from "@/components/states";
import { TodayScreen } from "@/features/sales/components/today-screen";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("screen.sales.today.title") };

export default function Page() {
  return (
    <>
      <PageHeader title={t("screen.sales.today.title")} description={t("screen.sales.today.job")} />
      <TodayScreen />
    </>
  );
}
