import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingList } from "@/components/states";
import { ProgramBuilder } from "@/features/programs/components/program-builder";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("screen.coach.program.title") };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<LoadingList label={t("common.loading")} />}>
      <ProgramBuilder clientId={id} />
    </Suspense>
  );
}
