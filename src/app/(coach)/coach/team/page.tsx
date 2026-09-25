import type { Metadata } from "next";
import { requireRole } from "@/features/auth/guard";
import { TeamScreen } from "@/features/coaching/components/team-screen";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("coachTeam.title") };

export default async function Page() {
  await requireRole("coach", ["head_coach"], "/coach/team");
  return <TeamScreen />;
}
