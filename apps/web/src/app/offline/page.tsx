import type { Metadata } from "next";
import { CloudOff } from "lucide-react";
import { EmptyState } from "@/components/states";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("offline.title") };

/** Shown by the service worker for a page that was never opened while online. Static, precached. */
export default function OfflinePage() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4">
      <EmptyState icon={CloudOff} title={t("offline.title")} body={t("offline.body")} action={{ href: "/c/workout", label: t("offline.workout") }} />
    </main>
  );
}
