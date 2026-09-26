"use client";

import Link from "next/link";
import { Check, PartyPopper } from "lucide-react";
import { EmptyState, ErrorState, LoadingList } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/me-context";
import { SlaBadge } from "@/features/leads/components/lead-badges";
import { ContactButtons } from "@/features/leads/components/contact-buttons";
import { useSalesMutation } from "@gymos/api/leads/use-leads";
import { completeFollowUp } from "@gymos/api/leads/leads";
import { formatTime, shortDuration } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { useToday } from "@gymos/api/sales/use-sales";
import { FlagBanner } from "./flag-banner";

/** /sales Today: flags first, then follow-ups (overdue first), new leads awaiting first contact, today's onboardings. */
export function TodayScreen() {
  const me = useMe();
  const { data, isPending, isError, refetch } = useToday(me.active.branchId ?? "");
  const done = useSalesMutation((id: string) => completeFollowUp(id));

  if (isPending) return <LoadingList label={t("common.loading")} />;
  if (isError) return <ErrorState title={t("today.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />;
  const empty = !data.flags.length && !data.follow_ups.length && !data.new_leads.length && !data.onboarded_today.length;

  return (
    <div className="grid gap-6">
      <FlagBanner flags={data.flags} showAssignee={me.active.role === "sales_manager"} />
      {empty ? <EmptyState icon={PartyPopper} title={t("today.caughtUp")} action={{ href: "/sales/leads/new", label: t("action.addLead") }} /> : null}

      {data.follow_ups.length ? (
        <section aria-labelledby="fu-h" className="grid gap-2">
          <h2 id="fu-h" className="font-semibold">{t("today.followUps")}</h2>
          <ul className="grid gap-2" data-testid="today-follow-ups">
            {data.follow_ups.map((f) => (
              <li key={f.id} data-testid="today-follow-up" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <span className="grid">
                  <Link href={f.lead_id ? `/sales/leads/${f.lead_id}` : "/sales"} className="font-medium underline-offset-4 hover:underline">{f.name}</Link>
                  <span className="text-sm">{f.title}</span>
                  <span className="text-xs">
                    {f.overdue ? <Badge variant="destructive">{t("today.overdue", { time: shortDuration(Date.now() - new Date(f.due_at).getTime()) })}</Badge> : t("today.dueAt", { time: formatTime(f.due_at) })}
                  </span>
                </span>
                <span className="flex gap-2">
                  <ContactButtons compact target={{ leadId: f.lead_id ?? undefined, clientId: f.client_id ?? undefined, name: f.name, phone: f.phone }} />
                  <Button size="sm" disabled={done.isPending} onClick={() => done.mutate(f.id)} aria-label={t("followUps.markDone", { title: `${f.title} — ${f.name}` })}>
                    <Check aria-hidden />{t("followUps.done")}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.new_leads.length ? (
        <section aria-labelledby="nl-h" className="grid gap-2">
          <h2 id="nl-h" className="font-semibold">{t("today.newLeads")}</h2>
          <ul className="grid gap-2">
            {data.new_leads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <span className="grid gap-1">
                  <Link href={`/sales/leads/${l.id}`} className="font-medium underline-offset-4 hover:underline">{l.full_name}</Link>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">{l.source_name}<SlaBadge state={l.sla_state} dueAt={l.first_contact_due_at} /></span>
                </span>
                <span className="flex gap-2"><ContactButtons compact target={{ leadId: l.id, name: l.full_name, phone: l.phone }} /></span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.onboarded_today.length ? (
        <section aria-labelledby="ob-h" className="grid gap-2">
          <h2 id="ob-h" className="font-semibold">{t("today.onboarded")}</h2>
          <ul className="grid gap-2">
            {data.onboarded_today.map((l) => (
              <li key={l.id} className="rounded-lg border p-3">
                <Link href={`/sales/leads/${l.id}`} className="font-medium underline-offset-4 hover:underline">{l.full_name}</Link>
                <span className="ms-2 text-xs text-muted-foreground">{formatTime(l.completed_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
