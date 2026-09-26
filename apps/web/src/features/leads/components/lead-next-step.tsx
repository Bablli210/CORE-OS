import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { t, type MessageKey } from "@gymos/i18n";
import type { LeadDetail } from "@gymos/api/leads/leads";
import { lostReasonLabel } from "@gymos/api/leads/labels";

const HINT: Record<string, MessageKey> = {
  new: "leads.next.new",
  contacted: "leads.next.contacted",
  onboarded: "leads.next.onboarded",
  quoted: "leads.next.quoted",
  won: "leads.next.won",
  lost: "leads.next.lost",
};

/** One sentence saying what to do with this lead now, with the action when it isn't already on the screen. */
export function LeadNextStep({ lead }: { lead: LeadDetail }) {
  const quote = lead.deals.find((d) => d.status !== "cancelled");
  return (
    <div data-testid="lead-next-step" className="grid gap-3 rounded-lg border border-foreground/20 bg-card p-4 md:flex md:items-center md:justify-between">
      <div className="grid gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("leads.nextStep")}</p>
        <p className="font-medium">{t(HINT[lead.status] ?? "leads.next.new")}</p>
        {lead.status === "lost" && lead.lost_reason ? (
          <p className="text-sm text-destructive">
            {t(lostReasonLabel(lead.lost_reason))}
            {lead.lost_note ? ` — ${lead.lost_note}` : ""}
          </p>
        ) : null}
      </div>
      {lead.status === "onboarded" ? (
        <Link href={`/sales/deals/new?lead=${lead.id}`} className={buttonVariants()}>
          <FileText aria-hidden />
          {t("leads.createQuote")}
        </Link>
      ) : lead.status === "quoted" && quote ? (
        <Link href={`/sales/deals/${quote.id}`} className={buttonVariants({ variant: "outline" })}>
          {t("leads.openQuote")}
          <ArrowRight aria-hidden className="rtl:rotate-180" />
        </Link>
      ) : lead.converted_client_id ? (
        <Link href={`/sales/clients/${lead.converted_client_id}`} className={buttonVariants({ variant: "outline" })}>
          {t("leads.openClient")}
          <ArrowRight aria-hidden className="rtl:rotate-180" />
        </Link>
      ) : null}
    </div>
  );
}
