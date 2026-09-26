"use client";

import Link from "next/link";
import { Check, PartyPopper } from "lucide-react";
import { RowList, Section, Stack, SummaryStrip } from "@/components/layout";
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

const rowClass = "flex flex-wrap items-center gap-x-4 gap-y-2 p-3 md:p-4";

/**
 * /sales Today: a summary of the day, then flags, follow-ups (overdue first), new leads awaiting first contact and
 * today's onboardings — each a section with its count, rows in one card.
 */
export function TodayScreen() {
  const me = useMe();
  const { data, isPending, isError, refetch } = useToday(me.active.branchId ?? "");
  const done = useSalesMutation((id: string) => completeFollowUp(id));

  if (isPending) return <LoadingList label={t("common.loading")} />;
  if (isError) return <ErrorState title={t("today.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />;
  const empty = !data.flags.length && !data.follow_ups.length && !data.new_leads.length && !data.onboarded_today.length;
  const overdue = data.follow_ups.filter((f) => f.overdue).length;
  const breached = data.new_leads.filter((l) => l.sla_state === "breached").length;

  return (
    <Stack>
      <SummaryStrip
        label={t("today.glance")}
        items={[
          { label: t("today.summary.followUps"), value: data.follow_ups.length, href: "#follow-ups", tone: overdue ? "destructive" : "default", testId: "summary-follow-ups" },
          { label: t("today.summary.newLeads"), value: data.new_leads.length, href: "#new-leads", tone: breached ? "destructive" : data.new_leads.length ? "warning" : "default", testId: "summary-new-leads" },
          { label: t("today.summary.flags"), value: data.flags.length, href: "#flags", tone: data.flags.length ? "warning" : "default" },
          { label: t("today.summary.onboarded"), value: data.onboarded_today.length, href: "#onboarded" },
        ]}
      />
      {data.flags.length ? (
        <div id="flags">
          <FlagBanner flags={data.flags} showAssignee={me.active.role === "sales_manager"} />
        </div>
      ) : null}
      {empty ? <EmptyState icon={PartyPopper} title={t("today.caughtUp")} body={t("today.caughtUpBody")} action={{ href: "/sales/leads/new", label: t("action.addLead") }} /> : null}

      {data.follow_ups.length ? (
        <Section id="follow-ups" title={t("today.followUps")} count={data.follow_ups.length} description={t("today.followUpsHint")} plain>
          <RowList testId="today-follow-ups">
            {data.follow_ups.map((f) => (
              <li key={f.id} data-testid="today-follow-up" className={rowClass}>
                <span className="w-16 shrink-0 text-sm tabular-nums">
                  {f.overdue ? <Badge variant="destructive">{t("today.overdueShort")}</Badge> : formatTime(f.due_at)}
                </span>
                <span className="grid min-w-0 flex-1 basis-40">
                  <Link href={f.lead_id ? `/sales/leads/${f.lead_id}` : f.client_id ? `/sales/clients/${f.client_id}` : "/sales"} className="truncate font-medium underline-offset-4 hover:underline">
                    {f.name}
                  </Link>
                  <span className="truncate text-sm text-muted-foreground">
                    {f.title}
                    {f.overdue ? ` · ${t("today.overdue", { time: shortDuration(Date.now() - new Date(f.due_at).getTime()) })}` : ""}
                  </span>
                </span>
                <span className="flex gap-2">
                  <ContactButtons compact target={{ leadId: f.lead_id ?? undefined, clientId: f.client_id ?? undefined, name: f.name, phone: f.phone }} />
                  <Button size="sm" disabled={done.isPending} onClick={() => done.mutate(f.id)} aria-label={t("followUps.markDone", { title: `${f.title} — ${f.name}` })}>
                    <Check aria-hidden />
                    {t("followUps.done")}
                  </Button>
                </span>
              </li>
            ))}
          </RowList>
        </Section>
      ) : null}

      {data.new_leads.length ? (
        <Section id="new-leads" title={t("today.newLeads")} count={data.new_leads.length} description={t("today.newLeadsHint")} plain>
          <RowList>
            {data.new_leads.map((l) => (
              <li key={l.id} className={rowClass}>
                <span className="grid min-w-0 flex-1 basis-40 gap-1">
                  <Link href={`/sales/leads/${l.id}`} className="truncate font-medium underline-offset-4 hover:underline">
                    {l.full_name}
                  </Link>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {l.source_name}
                    <SlaBadge state={l.sla_state} dueAt={l.first_contact_due_at} />
                  </span>
                </span>
                <span className="flex gap-2">
                  <ContactButtons compact target={{ leadId: l.id, name: l.full_name, phone: l.phone }} />
                </span>
              </li>
            ))}
          </RowList>
        </Section>
      ) : null}

      {data.onboarded_today.length ? (
        <Section id="onboarded" title={t("today.onboarded")} count={data.onboarded_today.length} description={t("today.onboardedHint")} plain>
          <RowList>
            {data.onboarded_today.map((l) => (
              <li key={l.id} className={rowClass}>
                <span className="w-16 shrink-0 text-sm tabular-nums">{formatTime(l.completed_at)}</span>
                <Link href={`/sales/leads/${l.id}`} className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline">
                  {l.full_name}
                </Link>
              </li>
            ))}
          </RowList>
        </Section>
      ) : null}
    </Stack>
  );
}
