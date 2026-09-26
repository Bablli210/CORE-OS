import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingList } from "@/components/states";
import { ScheduleScreen } from "@/features/sessions/components/schedule-screen";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("schedule.title") };

export default function Page() {
  return (
    <Suspense fallback={<LoadingList label={t("common.loading")} rows={6} />}>
      <ScheduleScreen />
    </Suspense>
  );
}
