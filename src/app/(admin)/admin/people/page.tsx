import type { Metadata } from "next";
import { PageHeader } from "@/components/states";
import { PeopleScreen } from "@/features/admin/components/people-screen";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("people.title") };

export default function PeoplePage() {
  return (
    <>
      <PageHeader title={t("people.title")} description={t("people.description")} />
      <PeopleScreen />
    </>
  );
}
