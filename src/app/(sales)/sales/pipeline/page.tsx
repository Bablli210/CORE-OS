import type { Metadata } from "next";
import { PageHeader } from "@/components/states";
import { PipelineBoard } from "@/features/leads/components/pipeline-board";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("screen.sales.pipeline.title") };

export default function PipelinePage() {
  return (
    <>
      <PageHeader title={t("screen.sales.pipeline.title")} description={t("screen.sales.pipeline.job")} />
      <PipelineBoard />
    </>
  );
}
