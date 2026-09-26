import type { Metadata } from "next";
import { ProfileScreen } from "@/features/training/components/profile-screen";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("profile.title") };

export default function Page() {
  return <ProfileScreen />;
}
