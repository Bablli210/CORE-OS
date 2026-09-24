import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/screen-placeholder";
import { t } from "@/lib/i18n";
import { requireRole } from "@/features/auth/guard";

export const metadata: Metadata = { title: t("screen.coach.team.title") };

export default async function Page() {
  await requireRole("coach", ["head_coach"], "/coach/team");
  return <ScreenPlaceholder screen="coach.team" />;
}
