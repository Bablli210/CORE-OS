"use client";

import { ClipboardList } from "lucide-react";
import { EmptyState, ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { useTemplates } from "../hooks/use-program-draft";
import { ProgramPreview } from "./program-preview";

/** /coach/programs — the templates a coach can start from (gym-wide and their own). Programs are built on a client's page. */
export function TemplatesScreen() {
  const { data, isPending, isError, refetch } = useTemplates();
  return (
    <>
      <PageHeader title={t("templates.title")} description={t("templates.description")} />
      {isPending ? (
        <LoadingList label={t("common.loading")} />
      ) : isError ? (
        <ErrorState title={t("templates.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />
      ) : data.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t("templates.empty")} body={t("templates.emptyBody")} action={{ href: "/coach/clients", label: t("action.allClients") }} />
      ) : (
        <div className="grid gap-4">
          {data.map((tpl) => (
            <details key={tpl.id} className="rounded-lg border p-3" data-testid="template">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <span className="font-medium">{tpl.name}</span>
                <Badge variant="outline">{tpl.gym_wide ? t("program.gymWide") : tpl.owner_name}</Badge>
                <span className="text-sm text-muted-foreground">{t("templates.detail", { days: tpl.days.length, exercises: tpl.days.reduce((n, d) => n + d.exercises.length, 0) })}</span>
              </summary>
              <div className="mt-3"><ProgramPreview days={tpl.days} /></div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
