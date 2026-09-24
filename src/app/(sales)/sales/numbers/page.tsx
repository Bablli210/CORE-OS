import type { Metadata } from "next";
import { PageHeader } from "@/components/states";
import { NumbersScreen } from "@/features/sales/components/numbers-screen";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("screen.sales.numbers.title") };

export default function Page() {
  return (
    <>
      <PageHeader title={t("screen.sales.numbers.title")} description={t("screen.sales.numbers.job")} />
      <NumbersScreen />
    </>
  );
}
