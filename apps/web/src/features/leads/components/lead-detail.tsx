"use client";

import Link from "next/link";
import { FileText, UserRoundCog, XCircle } from "lucide-react";
import { useState } from "react";
import { Facts, PageHeader, Section, Stack } from "@/components/layout";
import { ErrorState, LoadingList } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { daysSince, formatDateTime, formatEGP } from "@gymos/api/format";
import { t, type MessageKey } from "@gymos/i18n";
import { useLead } from "@gymos/api/leads/use-leads";
import { interestLabel } from "@gymos/api/leads/labels";
import { ContactButtons } from "./contact-buttons";
import { FollowUpsPanel } from "./follow-ups-panel";
import { SlaBadge, StageBadge } from "./lead-badges";
import { LeadNextStep } from "./lead-next-step";
import { LeadStepper } from "./lead-stepper";
import { LogTouchSheet } from "./log-touch-sheet";
import { LostReasonSheet } from "./lost-reason-sheet";
import { OnboardingShare } from "./onboarding-share";
import { OnboardingSummary } from "./onboarding-summary";
import { ReassignSheet } from "./reassign-sheet";
import { TouchTimeline } from "./touch-timeline";

/**
 * /sales/leads/[id]. Top: who, where they are (stage tracker) and the next step. Left: the work (onboarding answers,
 * contact history). Right: the facts, follow-ups, quotes and the rarer actions. Primary action: Log touch.
 */
export function LeadDetailScreen({ id }: { id: string }) {
  const { data: lead, isPending, isError, refetch } = useLead(id);
  const [sheet, setSheet] = useState<"touch" | "lost" | "assign" | null>(null);

  if (isPending) return <LoadingList label={t("common.loading")} />;
  if (isError)
    return <ErrorState title={t("leads.error.detail")} body={t("leads.error.detailBody")} action={<Link href="/sales/leads" className={buttonVariants({ variant: "outline" })}>{t("action.allLeads")}</Link>} />;

  const open = lead.status !== "won" && lead.status !== "lost";
  return (
    <div className="grid gap-6 pb-20 md:pb-0">
      <PageHeader
        back={{ href: "/sales/leads", label: t("action.allLeads") }}
        title={lead.full_name}
        description={[lead.source_name, lead.branch_name].filter(Boolean).join(" · ")}
        meta={
          <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" data-testid="lead-stage">
            <StageBadge status={lead.status} /> {t("pipeline.daysInStage", { n: daysSince(lead.stage_since) })}
            <SlaBadge state={lead.sla_state} dueAt={lead.first_contact_due_at} />
          </span>
        }
        actions={open ? <ContactButtons target={{ leadId: lead.id, name: lead.full_name, phone: lead.phone }} /> : undefined}
      />
      <LeadStepper status={lead.status} />
      <LeadNextStep lead={lead} />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Stack>
          <Section title={t("leads.onboarding")} description={lead.onboarding.completed_at ? undefined : t("leads.onboardingHint")}>
            <div className="grid gap-4">
              <OnboardingSummary responses={lead.onboarding.responses} completedAt={lead.onboarding.completed_at} />
              {open && !lead.onboarding.completed_at ? <OnboardingShare lead={{ id: lead.id, name: lead.full_name, phone: lead.phone }} resend={lead.onboarding.link_sent} /> : null}
            </div>
          </Section>
          <Section
            title={t("leads.touches")}
            count={lead.touches.length}
            description={t("leads.touchesHint")}
            action={
              open ? (
                <div className="fixed inset-x-0 bottom-bottom-bar z-20 border-t bg-background p-3 md:static md:border-0 md:bg-transparent md:p-0">
                  <Button size="block" className="md:w-auto" onClick={() => setSheet("touch")}>
                    {t("leads.logTouch")}
                  </Button>
                </div>
              ) : undefined
            }
          >
            <TouchTimeline touches={lead.touches} />
          </Section>
        </Stack>

        <Stack className="gap-6">
          <Section title={t("leads.details")}>
            <Facts
              className="md:grid-cols-2 lg:grid-cols-1"
              items={[
                { label: t("leads.phone"), value: <span dir="ltr">{lead.phone}</span> },
                { label: t("leads.owner"), value: lead.owner_name ?? t("capture.unassigned") },
                { label: t("leads.interestedIn"), value: lead.interest_tags.map((i) => t(interestLabel(i))).join(", ") || t("leads.noInterests") },
                { label: t("leads.source"), value: lead.source_name ?? "—" },
              ]}
            />
          </Section>
          <Section title={t("leads.followUps")} count={lead.follow_ups.filter((f) => f.status === "open").length}>
            <FollowUpsPanel lead={lead} />
          </Section>
          <Section
            title={t("leads.deals")}
            count={lead.deals.length}
            action={
              open && lead.status !== "onboarded" ? (
                <Link href={`/sales/deals/new?lead=${lead.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <FileText aria-hidden />
                  {t("leads.createQuote")}
                </Link>
              ) : undefined
            }
          >
            {lead.deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("leads.noDeals")}</p>
            ) : (
              <ul className="grid gap-2">
                {lead.deals.map((d) => (
                  <li key={d.id}>
                    <Link href={`/sales/deals/${d.id}`} className="flex justify-between gap-2 text-sm underline-offset-4 hover:underline">
                      <span>
                        {formatDateTime(d.created_at)} · {t(`deal.status.${d.status}` as MessageKey)}
                      </span>
                      <span className="tabular-nums">{formatEGP(d.total_piastres)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          {open && (lead.can_manage || lead.can_edit) ? (
            <div className="grid gap-2">
              {lead.can_manage ? (
                <Button variant="outline" onClick={() => setSheet("assign")}>
                  <UserRoundCog aria-hidden />
                  {lead.owner_membership_id ? t("leads.reassign") : t("leads.assign")}
                </Button>
              ) : null}
              {lead.can_edit ? (
                <Button variant="ghost" className="text-destructive" onClick={() => setSheet("lost")}>
                  <XCircle aria-hidden />
                  {t("leads.markLost")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </Stack>
      </div>

      {sheet === "touch" ? <LogTouchSheet open onClose={() => { setSheet(null); void refetch(); }} target={{ leadId: lead.id, name: lead.full_name }} /> : null}
      {sheet === "lost" ? <LostReasonSheet open onClose={() => setSheet(null)} lead={{ id: lead.id, name: lead.full_name }} /> : null}
      {sheet === "assign" ? <ReassignSheet open onClose={() => setSheet(null)} lead={{ id: lead.id, name: lead.full_name, branchId: lead.branch_id, ownerId: lead.owner_membership_id }} /> : null}
    </div>
  );
}
