import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingList } from "@/components/states";
import { ClientScreen } from "@/features/coaching/components/client-screen";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("screen.coach.client.title") };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<LoadingList label={t("common.loading")} />}>
      <ClientScreen id={id} />
    </Suspense>
  );
}
