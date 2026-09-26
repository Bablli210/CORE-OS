"use client";

import { Flag as FlagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactButtons } from "@/features/leads/components/contact-buttons";
import { useSalesMutation } from "@gymos/api/leads/use-leads";
import { completeFollowUp } from "@gymos/api/leads/leads";
import { shortDuration } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import type { Flag } from "@gymos/api/sales/sales";

/** docs/04 FlagBanner: clients flagged for sales (trained unpaid, kiosk refusal, renewal). Live via Realtime. */
export function FlagBanner({ flags, showAssignee = false }: { flags: Flag[]; showAssignee?: boolean }) {
  const close = useSalesMutation((id: string) => completeFollowUp(id));
  if (!flags.length) return null;
  return (
    <section aria-label={t("flags.title")} data-testid="flag-banner" className="grid gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><FlagIcon aria-hidden className="size-4 text-destructive" />{t("flags.title")} ({flags.length})</h2>
      <ul className="grid gap-2">
        {flags.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background p-2">
            <span className="grid">
              <span className="font-medium">{f.client_name}</span>
              <span className="text-sm">{f.note}</span>
              <span className="text-xs text-muted-foreground">
                {[t("flags.ago", { time: shortDuration(Date.now() - new Date(f.created_at).getTime()) }), f.coach_name && t("flags.coach", { name: f.coach_name }), showAssignee && f.assignee_name].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="flex gap-2">
              {f.phone ? <ContactButtons compact target={{ clientId: f.client_id, name: f.client_name, phone: f.phone }} /> : null}
              <Button size="sm" variant="outline" disabled={close.isPending} onClick={() => close.mutate(f.id)}>{t("flags.handled")}</Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
