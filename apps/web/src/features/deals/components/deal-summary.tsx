import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatEGP } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { approvalReasonLabel } from "@gymos/api/deals/labels";
import type { Deal } from "@gymos/api/deals/deals";

/** Subtotal / discount / total exactly as fn_price_deal stored them, plus the approval preview for drafts. */
export function DealSummary({ deal, saving = false }: { deal: Deal; saving?: boolean }) {
  const priced = deal.issues.length === 0;
  return (
    <div className="grid gap-2 rounded-lg border p-4" data-testid="deal-summary" aria-busy={saving}>
      {priced ? (
        <dl className="grid gap-1 text-sm">
          <div className="flex justify-between"><dt>{t("deal.subtotal")}</dt><dd>{formatEGP(deal.subtotal_piastres)}</dd></div>
          <div className="flex justify-between"><dt>{t("deal.discount")}</dt><dd>− {formatEGP(deal.discount_piastres)}</dd></div>
          <div className="flex justify-between text-base font-semibold"><dt>{t("deal.total")}</dt><dd data-testid="deal-total">{formatEGP(deal.total_piastres)}</dd></div>
          {deal.paid_piastres > 0 ? (
            <>
              <div className="flex justify-between"><dt>{t("deal.paid")}</dt><dd>{formatEGP(deal.paid_piastres)}</dd></div>
              <div className="flex justify-between font-medium"><dt>{t("deal.remaining")}</dt><dd data-testid="deal-remaining">{formatEGP(deal.remaining_piastres)}</dd></div>
            </>
          ) : null}
        </dl>
      ) : (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle aria-hidden className="size-4" />{t("deal.error.needsCoach")}</p>
      )}
      {deal.approval_preview && priced && deal.items.length ? (
        deal.approval_preview.needs_approval ? (
          <p className="flex items-start gap-2 text-sm" data-testid="approval-indicator">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              {t("deal.needsApproval")}{" "}
              {deal.approval_preview.reasons.map((r) => t(approvalReasonLabel(r), { pct: deal.approval_preview!.effective_pct, allowance: deal.approval_preview!.allowance_pct })).join(" ")}
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm" data-testid="approval-indicator"><CheckCircle2 aria-hidden className="size-4 text-success" />{t("deal.autoApproved")}</p>
        )
      ) : null}
    </div>
  );
}
