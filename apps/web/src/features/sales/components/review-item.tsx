"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSalesMutation } from "@gymos/api/leads/use-leads";
import { reviewLead } from "@gymos/api/leads/leads";
import { t } from "@gymos/i18n";
import type { Queue } from "@gymos/api/sales/sales";

/** Review queue row: approve or reject with a note (fn_review_lead; rejecting marks the lead lost). */
export function ReviewItem({ lead }: { lead: Queue["review"][number] }) {
  const [note, setNote] = useState("");
  const decide = useSalesMutation(({ approve }: { approve: boolean }) => reviewLead(lead.id, approve, note));
  return (
    <li className="grid gap-2 rounded-lg border p-3">
      <span className="flex flex-wrap justify-between gap-2">
        <Link href={`/sales/leads/${lead.id}`} className="font-medium underline-offset-4 hover:underline">{lead.full_name}</Link>
        <span className="text-xs text-muted-foreground">{[lead.source_name, lead.owner_name].filter(Boolean).join(" · ")}</span>
      </span>
      <Input aria-label={t("queue.reviewNote", { name: lead.full_name })} placeholder={t("queue.reviewNotePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
      <span className="flex gap-2">
        <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ approve: true })}>{t("queue.approve")}</Button>
        <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ approve: false })}>{t("queue.reject")}</Button>
      </span>
    </li>
  );
}
