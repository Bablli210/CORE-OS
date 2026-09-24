"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dealStatusLabel, type DealStatus } from "@/features/deals/labels";
import { formatDate, formatEGP } from "@/lib/format";
import { t } from "@/lib/i18n";
import { clientKeys, fetchSalesClient, type Lot } from "../queries/sales-client";
import { ExtendSheet } from "./extend-sheet";

const lotBadge = (s: Lot["status"]) => (s === "active" ? "success" : s === "expired" || s === "refunded" ? "destructive" : "outline");

/** /sales/clients/[id]: the client's packs (per coach, with expiry), memberships and deals; expiry extension lives here. */
export function SalesClientScreen({ id }: { id: string }) {
  const { data: c, isPending, isError } = useQuery({ queryKey: clientKeys.detail(id), queryFn: () => fetchSalesClient(id) });
  const [extending, setExtending] = useState<Lot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (isPending) return <LoadingList label={t("common.loading")} />;
  if (isError) return <ErrorState title={t("client.error.load")} body={t("client.error.loadBody")} action={<Link href="/sales" className={buttonVariants({ variant: "outline" })}>{t("nav.backToday")}</Link>} />;
  const canAct = c.can_extend || c.can_request_extension;

  return (
    <div className="grid gap-4">
      <PageHeader
        title={c.full_name}
        description={[c.branch_name, c.coach_name && t("client.coach", { name: c.coach_name }), c.rep_name && t("deal.rep", { name: c.rep_name })].filter(Boolean).join(" · ")}
        actions={<Link href={`/sales/deals/new?client=${c.id}`} className={buttonVariants()}>{t("client.renew")}</Link>}
      />
      {notice ? <p role="status" className="rounded-md border border-success p-3 text-sm">{notice}</p> : null}
      <Card>
        <CardHeader><CardTitle>{t("client.packs")}</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {c.lots.length === 0 ? <p className="text-sm text-muted-foreground">{t("client.noPacks")}</p> : null}
          <ul className="grid gap-2">
            {c.lots.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3" data-testid="lot-row">
                <span className="grid">
                  <span className="font-medium">{t("client.lotLine", { remaining: l.qty_remaining, issued: l.qty_issued, coach: l.coach_name ?? "" })}</span>
                  <span className="text-xs text-muted-foreground">{t("client.lotExpiry", { date: formatDate(l.expires_at) })} · {formatEGP(l.per_session_piastres)}/{t("client.session")}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={lotBadge(l.status)}>{t(`lot.status.${l.status}`)}</Badge>
                  {l.pending_extension ? <Badge variant="warning">{t("extend.pending")}</Badge> : canAct && (l.status === "active" || l.status === "expired") ? (
                    <Button size="sm" variant="outline" onClick={() => setExtending(l)}>{t("extend.button")}</Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("client.memberships")}</CardTitle></CardHeader>
          <CardContent>
            {c.entitlements.length === 0 ? <p className="text-sm text-muted-foreground">{t("client.noMemberships")}</p> : (
              <ul className="grid gap-1 text-sm">
                {c.entitlements.map((e) => <li key={e.id} className="flex justify-between gap-2"><span>{e.product_name ?? e.type}</span><span>{formatDate(e.starts_at)} → {formatDate(e.ends_at)}</span></li>)}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("client.deals")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {c.deals.map((d) => (
                <li key={d.id}><Link href={`/sales/deals/${d.id}`} className="flex justify-between gap-2 underline-offset-4 hover:underline"><span>{formatDate(d.created_at)} · {t(dealStatusLabel(d.status as DealStatus))}</span><span>{formatEGP(d.total_piastres)}</span></Link></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      {extending ? (
        <ExtendSheet lot={extending} direct={c.can_extend} onClose={() => setExtending(null)} onDone={(pending) => setNotice(pending ? t("extend.sentForApproval") : t("extend.applied"))} />
      ) : null}
    </div>
  );
}
