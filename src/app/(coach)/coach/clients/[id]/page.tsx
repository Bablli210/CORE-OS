import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/screen-placeholder";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("screen.coach.client.title") };

export default function Page() {
  return <ScreenPlaceholder screen="coach.client" />;
}
