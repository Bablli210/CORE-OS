import type { Metadata } from "next";
import { ClientsScreen } from "@/features/coaching/components/clients-screen";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("clients.title") };

export default function Page() {
  return <ClientsScreen />;
}
