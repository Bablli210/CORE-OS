import type { Metadata } from "next";
import { ClientToday } from "@/features/training/components/client-today";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("nav.today") };

export default function Page() {
  return <ClientToday />;
}
