"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { whatsappLink } from "@/lib/contact-links";
import { formatDate, formatDateTime, formatEGP } from "@/lib/format";
import { t, type MessageKey } from "@/lib/i18n";
import { useCredits } from "../hooks/use-client";
import { FreezeSheet, RenewSheet } from "./credit-sheets";

/**
 * /c/credits — balance and expiry per coach (fn_credit_balances), packs, memberships, payments, the session ledger.
 * Renew and Request freeze go to people; there is no self-service extension ("Ask your advisor").
 */
export function CreditsScreen() {
  const { data: c, isPending, isError, refetch } = useCredits();
  const [sheet, setSheet] = useState<"renew" | "freeze" | null>(null);
  const [notice, setNotice] = useState("");
  if (isPending) return <LoadingList label={t("common.loading")} />;
  if (isError || !c) return <ErrorState title={t("credits.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />;

  return (
    <div className="grid max-w-2xl gap-4">
      <PageHeader title={t("credits.screenTitle")} />
      <p role="status" className="min-h-5 text-sm text-success">{notice}</p>
      <Card>
        <CardHeader><CardTitle>{t("credits.title")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {c.balances.length === 0 ? <EmptyState title={t("credits.none")} body={t("credits.noneBody")} /> : (
            <ul className="grid gap-2" data-testid="client-balances">
              {c.balances.map((b) => (
                <li key={b.coach_membership_id} data-testid="balance-row" data-coach={b.coach_name} data-balance={b.balance} className="flex items-center justify-between gap-3 rounded-md bg-muted p-3">
                  <span className="grid">
                    <span className="font-medium">{t("credits.withCoach", { count: b.balance, coach: b.coach_name })}</span>
                    <span className="text-xs text-muted-foreground" data-testid="next-expiry">{t("credits.expires", { date: formatDate(b.next_expiry) })}</span>
                  </span>
                  {b.balance <= 2 ? <Badge variant="warning">{t("credits.low")}</Badge> : null}
                </li>
              ))}
            </ul>
          )}
          {c.renewal_open ? <p className="text-sm text-muted-foreground" data-testid="renewal-open">{t("credits.renewOpen", { name: c.advisor?.first_name ?? "" })}</p> : (
            <Button size="block" onClick={() => setSheet("renew")}>{t("credits.renew")}</Button>
          )}
          <div className="grid gap-1 rounded-md border p-3 text-sm">
            <p>{t("credits.extendHint")}</p>
            {c.advisor?.phone ? (
              <a href={whatsappLink(c.advisor.phone, t("credits.extendMessage"))} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <MessageCircle aria-hidden />{t("credits.askAdvisor", { name: c.advisor.first_name })}
              </a>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("credits.packs")}</CardTitle></CardHeader>
        <CardContent>
          <ul className="grid gap-1 text-sm">
            {c.lots.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2">
                <span>{t("client.lotLine", { remaining: l.qty_remaining, issued: l.qty_issued, coach: l.coach_name })}</span>
                <span className="text-muted-foreground">{t("client.lotExpiry", { date: formatDate(l.expires_at) })} · {t(`lot.status.${l.status}` as MessageKey)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("client.memberships")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <ul className="grid gap-1 text-sm">
            {c.memberships.map((m) => <li key={m.id} className="flex justify-between gap-2"><span>{m.product_name}</span><span className="text-muted-foreground">{formatDate(m.starts_at)} – {formatDate(m.ends_at)} · {m.status}</span></li>)}
          </ul>
          {c.freezes.map((f) => <p key={f.id} className="text-sm">{t("credits.freeze.line", { days: f.days, from: formatDate(f.starts_at), status: t(`credits.freeze.status.${f.status}` as MessageKey) })}</p>)}
          <Button variant="outline" onClick={() => setSheet("freeze")}>{t("credits.freeze.title")}</Button>
        </CardContent>
      </Card>

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-medium">{t("credits.history")}</summary>
        <h3 className="mt-3 text-sm font-semibold">{t("credits.payments")}</h3>
        <ul className="grid gap-1 text-sm">{c.payments.map((p) => <li key={p.id} className="flex justify-between"><span>{formatDate(p.received_at)} · {p.method}</span><span className={p.voided ? "line-through" : ""}>{formatEGP(p.amount_piastres)}</span></li>)}</ul>
        <h3 className="mt-3 text-sm font-semibold">{t("credits.ledger")}</h3>
        <ul className="grid gap-1 text-sm">{c.ledger.map((g) => <li key={g.id} className="flex justify-between"><span>{formatDateTime(g.session_at ?? g.created_at)} · {t(`credits.entry.${g.entry_type}` as MessageKey)} · {g.coach_name}</span><span className="tabular-nums">{g.qty > 0 ? `+${g.qty}` : g.qty}</span></li>)}</ul>
      </details>

      {sheet === "renew" ? <RenewSheet clientId={c.client_id} onClose={() => setSheet(null)} onDone={() => { setSheet(null); setNotice(t("credits.renewSent", { name: c.advisor?.first_name ?? "" })); }} /> : null}
      {sheet === "freeze" ? <FreezeSheet clientId={c.client_id} maxDays={c.freeze_max_days} onClose={() => setSheet(null)} onDone={() => { setSheet(null); setNotice(t("credits.freeze.sent")); }} /> : null}
    </div>
  );
}
