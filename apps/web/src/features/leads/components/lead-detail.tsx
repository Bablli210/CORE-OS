"use client";

import Link from "next/link";
import { FileText, UserRoundCog, XCircle } from "lucide-react";
import { useState } from "react";
import { ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { daysSince, formatDateTime, formatEGP } from "@gymos/api/format";
import { t, type MessageKey } from "@gymos/i18n";
import { useLead } from "@gymos/api/leads/use-leads";
import { interestLabel, lostReasonLabel } from "@gymos/api/leads/labels";
import { ContactButtons } from "./contact-buttons";
import { FollowUpsPanel } from "./follow-ups-panel";
import { SlaBadge, StageBadge } from "./lead-badges";
import { LogTouchSheet } from "./log-touch-sheet";
import { LostReasonSheet } from "./lost-reason-sheet";
import { OnboardingShare } from "./onboarding-share";
import { OnboardingSummary } from "./onboarding-summary";
import { ReassignSheet } from "./reassign-sheet";
import { TouchTimeline } from "./touch-timeline";

/** /sales/leads/[id]: header, onboarding answers, touches, follow-ups, deals. Primary action: Log touch. */
export function LeadDetailScreen({ id }: { id: string }) {
  const { data: lead, isPending, isError, refetch } = useLead(id);
  const [sheet, setSheet] = useState<"touch" | "lost" | "assign" | null>(null);

  if (isPending) return <LoadingList label={t("common.loading")} />;
  if (isError)
    return <ErrorState title={t("leads.error.detail")} body={t("leads.error.detailBody")} action={<Link href="/sales/leads" className={buttonVariants({ variant: "outline" })}>{t("action.allLeads")}</Link>} />;

  const open = lead.status !== "won" && lead.status !== "lost";
  return (
    <div className="grid gap-4 pb-20 md:pb-0">
      <PageHeader
        title={lead.full_name}
        description={[lead.source_name, lead.branch_name].filter(Boolean).join(" · ")}
        actions={<span className="flex flex-wrap gap-2">{open ? <ContactButtons target={{ leadId: lead.id, name: lead.full_name, phone: lead.phone }} /> : null}</span>}
      />
      <Card>
        <CardContent className="grid gap-2 pt-4 text-sm md:grid-cols-2">
          <p className="flex flex-wrap items-center gap-2" data-testid="lead-stage">
            <StageBadge status={lead.status} /> {t("pipeline.daysInStage", { n: daysSince(lead.stage_since) })}
            <SlaBadge state={lead.sla_state} dueAt={lead.first_contact_due_at} />
          </p>
          <p>{t("leads.owner")}: <span className="font-medium">{lead.owner_name ?? t("capture.unassigned")}</span></p>
          <p dir="ltr" className="text-start">{lead.phone}</p>
          <p>{lead.interest_tags.map((i) => t(interestLabel(i))).join(", ") || t("leads.noInterests")}</p>
          {lead.status === "lost" && lead.lost_reason ? <p className="text-destructive">{t(lostReasonLabel(lead.lost_reason))}{lead.lost_note ? ` — ${lead.lost_note}` : ""}</p> : null}
        </CardContent>
      </Card>

      {lead.converted_client_id ? (
        <Link href={`/sales/clients/${lead.converted_client_id}`} className={buttonVariants({ variant: "outline" })}>{t("leads.openClient")}</Link>
      ) : null}
      {open ? (
        <div className="flex flex-wrap gap-2">
          <Link href={`/sales/deals/new?lead=${lead.id}`} className={buttonVariants({ variant: "outline" })}><FileText aria-hidden />{t("leads.createQuote")}</Link>
          {lead.can_manage ? <Button variant="outline" onClick={() => setSheet("assign")}><UserRoundCog aria-hidden />{lead.owner_membership_id ? t("leads.reassign") : t("leads.assign")}</Button> : null}
          {lead.can_edit ? <Button variant="outline" onClick={() => setSheet("lost")}><XCircle aria-hidden />{t("leads.markLost")}</Button> : null}
        </div>
      ) : null}

      <Card>
        <CardHeader><CardTitle>{t("leads.onboarding")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <OnboardingSummary responses={lead.onboarding.responses} completedAt={lead.onboarding.completed_at} />
          {open && !lead.onboarding.completed_at ? (
            <OnboardingShare lead={{ id: lead.id, name: lead.full_name, phone: lead.phone }} resend={lead.onboarding.link_sent} />
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("leads.touches")}</CardTitle></CardHeader>
          <CardContent><TouchTimeline touches={lead.touches} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("leads.followUps")}</CardTitle></CardHeader>
          <CardContent><FollowUpsPanel lead={lead} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("leads.deals")}</CardTitle></CardHeader>
        <CardContent>
          {lead.deals.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("leads.noDeals")}</p>
          ) : (
            <ul className="grid gap-2">
              {lead.deals.map((d) => (
                <li key={d.id}><Link href={`/sales/deals/${d.id}`} className="flex justify-between text-sm underline-offset-4 hover:underline"><span>{formatDateTime(d.created_at)} · {t(`deal.status.${d.status}` as MessageKey)}</span><span>{formatEGP(d.total_piastres)}</span></Link></li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {open ? (
        <div className="fixed inset-x-0 bottom-bottom-bar z-20 border-t bg-background p-3 md:static md:border-0 md:p-0">
          <Button size="block" className="md:w-auto" onClick={() => setSheet("touch")}>{t("leads.logTouch")}</Button>
        </div>
      ) : null}

      {sheet === "touch" ? <LogTouchSheet open onClose={() => { setSheet(null); void refetch(); }} target={{ leadId: lead.id, name: lead.full_name }} /> : null}
      {sheet === "lost" ? <LostReasonSheet open onClose={() => setSheet(null)} lead={{ id: lead.id, name: lead.full_name }} /> : null}
      {sheet === "assign" ? <ReassignSheet open onClose={() => setSheet(null)} lead={{ id: lead.id, name: lead.full_name, branchId: lead.branch_id, ownerId: lead.owner_membership_id }} /> : null}
    </div>
  );
}
