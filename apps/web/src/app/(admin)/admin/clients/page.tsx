import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/screen-placeholder";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("screen.admin.clients.title") };

export default function Page() {
  return <ScreenPlaceholder screen="admin.clients" />;
}
