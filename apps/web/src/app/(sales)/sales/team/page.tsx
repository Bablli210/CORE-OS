import type { Metadata } from "next";
import { PageHeader } from "@/components/states";
import { requireRole } from "@/features/auth/guard";
import { TeamScreen } from "@/features/sales/components/team-screen";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("screen.sales.team.title") };

export default async function Page() {
  await requireRole("sales", ["sales_manager"], "/sales/team");
  return (
    <>
      <PageHeader title={t("screen.sales.team.title")} description={t("screen.sales.team.job")} />
      <TeamScreen />
    </>
  );
}
