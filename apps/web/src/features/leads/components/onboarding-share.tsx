"use client";

import { MessageCircle, Tablet } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useMe } from "@/features/auth/me-context";
import { whatsappLink } from "@/lib/contact-links";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useSalesMutation } from "../hooks/use-leads";
import { issueOnboardingToken } from "../queries/leads";
import { salesErrorKey } from "../errors";

/**
 * Creates a fresh onboarding link (fn_issue_onboarding_token; the previous one stops working) and offers it as a
 * WhatsApp message to the lead or opens it to fill together on the rep's tablet.
 */
export function OnboardingShare({ lead, resend = false }: { lead: { id: string; name: string; phone: string }; resend?: boolean }) {
  const me = useMe();
  const [url, setUrl] = useState<string | null>(null);
  const issue = useSalesMutation(issueOnboardingToken);

  if (!url)
    return (
      <div className="grid gap-2">
        <Button
          variant={resend ? "outline" : "default"}
          size="block"
          disabled={issue.isPending}
          onClick={() => issue.mutate(lead.id, { onSuccess: (token) => setUrl(`${window.location.origin}/onboard/${token}`) })}
        >
          {resend ? t("share.resend") : t("share.create")}
        </Button>
        {issue.isError ? <p role="alert" className="text-sm text-destructive">{t(salesErrorKey(issue.error))}</p> : null}
      </div>
    );

  const message = t("share.whatsappText", { name: lead.name.split(" ")[0], rep: me.profile.fullName.split(" ")[0], url });
  return (
    <div className="grid gap-2" data-testid="onboarding-share">
      <a href={whatsappLink(lead.phone, message)} target="_blank" rel="noreferrer" className={cn(buttonVariants({ size: "block" }))} data-testid="share-whatsapp">
        <MessageCircle aria-hidden />
        {t("share.sendWhatsapp")}
      </a>
      <a href={url} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "block" }))} data-testid="share-fill">
        <Tablet aria-hidden />
        {t("share.fillTogether")}
      </a>
      <p className="text-xs text-muted-foreground">{t("share.expires")}</p>
    </div>
  );
}
