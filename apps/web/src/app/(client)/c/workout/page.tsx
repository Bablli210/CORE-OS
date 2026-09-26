import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingList } from "@/components/states";
import { WorkoutScreen } from "@/features/training/components/workout-screen";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("workout.title") };

export default function Page() {
  return (
    <Suspense fallback={<LoadingList label={t("common.loading")} />}>
      <WorkoutScreen />
    </Suspense>
  );
}
