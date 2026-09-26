"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@gymos/i18n";
import { stageLabel } from "@gymos/api/leads/labels";
import type { PhoneMatch } from "@gymos/api/leads/leads";

/** Shown as soon as a typed phone matches an existing lead or client: open it instead of creating a duplicate. */
export function DuplicateNotice({ match }: { match: Extract<PhoneMatch, { found: true }> }) {
  const href = match.visible ? (match.kind === "lead" ? `/sales/leads/${match.id}` : null) : null;
  const text =
    match.kind === "lead"
      ? match.visible
        ? t("capture.dupLead", { name: match.name ?? "", stage: t(stageLabel(match.status)) })
        : t("capture.dupLeadOther", { owner: match.owner_name || t("capture.unassigned"), branch: match.branch_code })
      : match.name
        ? t("capture.dupClient", { name: match.name, branch: match.branch_code })
        : t("capture.dupClientOther", { branch: match.branch_code });
  return (
    <div role="alert" data-testid="duplicate-notice" className="grid gap-2 rounded-md border border-warning bg-warning/10 p-3 text-sm">
      <p className="flex items-start gap-2">
        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
        {text}
      </p>
      {href ? (
        <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {t("capture.openExisting")}
        </Link>
      ) : null}
    </div>
  );
}
