import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { buttonVariants } from "@/components/ui/button";
import { getMe } from "@/features/auth/me";
import { DeskActions } from "@/features/sales/components/desk-actions";
import { GettingStarted } from "@/features/guide/components/getting-started";
import { TodayScreen } from "@/features/sales/components/today-screen";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("screen.sales.today.title") };

export default async function Page() {
  const me = await getMe("sales");
  if (me?.active.role === "front_desk") {
    return (
      <div className="grid gap-8">
        <PageHeader title={t("desk.title")} description={t("desk.job")} />
        <GettingStarted />
        <DeskActions />
        <TodayScreen />
      </div>
    );
  }
  return (
    <>
      <PageHeader
        title={t("screen.sales.today.title")}
        description={t("screen.sales.today.job")}
        actions={
          <Link href="/sales/leads/new" className={buttonVariants()}>
            <UserPlus aria-hidden />
            {t("action.addLead")}
          </Link>
        }
      />
      <div className="grid gap-8">
        <GettingStarted />
        <TodayScreen />
      </div>
    </>
  );
}
