"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { useSalesMutation } from "@gymos/api/leads/use-leads";
import { addFollowUp, completeFollowUp, type LeadDetail } from "@gymos/api/leads/leads";
import { salesErrorKey } from "@gymos/api/leads/errors";

/** Open and past follow-ups on a lead; add one (title + when) or complete one in one tap. */
export function FollowUpsPanel({ lead }: { lead: LeadDetail }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const add = useSalesMutation(addFollowUp);
  const done = useSalesMutation((id: string) => completeFollowUp(id));
  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {lead.follow_ups.length === 0 ? <li className="text-sm text-muted-foreground">{t("followUps.none")}</li> : null}
        {lead.follow_ups.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 p-3">
            <span className="grid min-w-0">
              <span className={f.status === "open" ? "font-medium" : "text-muted-foreground line-through"}>{f.title}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(f.due_at)} · {f.assignee_name}</span>
            </span>
            {f.status === "open" ? (
              <Button size="sm" variant="outline" disabled={done.isPending} onClick={() => done.mutate(f.id)} aria-label={t("followUps.markDone", { title: f.title })}>
                <Check aria-hidden />
                {t("followUps.done")}
              </Button>
            ) : (
              <Badge>{t(f.status === "done" ? "followUps.statusDone" : "followUps.statusSkipped")}</Badge>
            )}
          </li>
        ))}
      </ul>
      {lead.can_edit ? (
        <form
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !due) return;
            add.mutate({ leadId: lead.id, title: title.trim(), dueAt: new Date(due).toISOString() }, { onSuccess: () => { setTitle(""); setDue(""); } });
          }}
        >
          <Input className="col-span-2" aria-label={t("followUps.title")} placeholder={t("followUps.titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input className="min-w-0" aria-label={t("followUps.due")} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          <Button type="submit" variant="outline" disabled={add.isPending || !title.trim() || !due}>{t("followUps.add")}</Button>
        </form>
      ) : null}
      {add.isError || done.isError ? <p role="alert" className="text-sm text-destructive">{t(salesErrorKey(add.error ?? done.error))}</p> : null}
    </div>
  );
}
