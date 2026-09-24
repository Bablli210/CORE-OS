import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/screen-placeholder";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("screen.sales.dealNew.title") };

export default function Page() {
  return <ScreenPlaceholder screen="sales.dealNew" />;
}
