"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { dealErrorKey } from "@gymos/api/deals/errors";
import { useMoneyMutation } from "@gymos/api/deals/use-deals";
import { addDays, cairoInstant, cairoToday } from "@gymos/api/sessions/week";
import { formatDate } from "@gymos/api/format";
import { t, type MessageKey } from "@gymos/i18n";
import { endFreeze, fetchClientRequests, requestFreezeFor, requestKeys, type Freeze } from "@gymos/api/credits/sales-client";

const badge = (s: Freeze["status"]) => (s === "active" ? "warning" : s === "ended" ? "outline" : s === "rejected" ? "destructive" : "secondary");

/**
 * Freezes on the sales client screen (docs/03 §4): the history with status, "Request freeze" on the client's behalf
 * (an approval for the sales manager, like the client's own request), and "End now" for the sales manager. The
 * nightly job ends a freeze on its date; either way the packs and memberships move by the frozen days.
 */
export function FreezeCard({ clientId, onNotice }: { clientId: string; onNotice: (text: string) => void }) {
  const r = useQuery({ queryKey: requestKeys.client(clientId), queryFn: () => fetchClientRequests(clientId) });
  const [asking, setAsking] = useState(false);
  const end = useMoneyMutation((id: string) => endFreeze(id));
  if (!r.data) return null;
  const open = r.data.freezes.find((f) => f.status === "pending" || f.status === "active");
  return (
    <Card data-testid="freeze-card">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{t("freeze.title")}</CardTitle>
        {r.data.can_freeze && !open ? <Button size="sm" variant="outline" onClick={() => setAsking(true)}>{t("freeze.request")}</Button> : null}
      </CardHeader>
      <CardContent className="grid gap-2">
        {r.data.freezes.length === 0 ? <p className="text-sm text-muted-foreground">{t("freeze.none")}</p> : (
          <ul className="grid gap-2">
            {r.data.freezes.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3" data-testid="freeze-row" data-status={f.status}>
                <span className="grid">
                  <span className="font-medium">{t("freeze.line", { from: formatDate(f.starts_at), to: formatDate(f.ends_at), days: f.days })}</span>
                  {f.reason ? <span className="text-xs text-muted-foreground">“{f.reason}”</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={badge(f.status)}>{t(`freeze.status.${f.status}` as MessageKey)}</Badge>
                  {f.status === "active" && r.data.can_end_freeze ? (
                    <Button size="sm" variant="outline" disabled={end.isPending} onClick={() => end.mutate(f.id, { onSuccess: () => onNotice(t("freeze.ended", { days: f.days })) })}>{t("freeze.endNow")}</Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        {end.isError ? <p role="alert" className="text-sm text-destructive">{t(dealErrorKey(end.error))}</p> : null}
      </CardContent>
      {asking ? <FreezeRequestSheet clientId={clientId} maxDays={r.data.freeze_max_days} onClose={() => setAsking(false)} onDone={() => { setAsking(false); onNotice(t("freeze.sent")); }} /> : null}
    </Card>
  );
}

function FreezeRequestSheet({ clientId, maxDays, onClose, onDone }: { clientId: string; maxDays: number; onClose: () => void; onDone: () => void }) {
  const [start, setStart] = useState(addDays(cairoToday(), 1));
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  const m = useMoneyMutation(() => requestFreezeFor(clientId, cairoInstant(start, "00:00"), cairoInstant(addDays(start, days), "00:00"), reason.trim()));
  return (
    <Sheet open onClose={onClose} title={t("freeze.request")} closeLabel={t("common.close")}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (reason.trim()) m.mutate(undefined, { onSuccess: onDone }); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("credits.freeze.from")} htmlFor="sf-from"><Input id="sf-from" type="date" min={cairoToday()} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label={t("credits.freeze.days", { max: maxDays })} htmlFor="sf-days"><Input id="sf-days" type="number" min={1} max={maxDays} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} /></Field>
        </div>
        <Field label={t("common.reasonRequired")} htmlFor="sf-reason"><Textarea id="sf-reason" className="font-sans" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <p className="text-sm text-muted-foreground">{t("freeze.hint")}</p>
        {m.isError ? <p role="alert" className="text-sm text-destructive">{t(dealErrorKey(m.error))}</p> : null}
        <Button type="submit" size="block" disabled={!reason.trim() || !start || m.isPending}>{t("freeze.send")}</Button>
      </form>
    </Sheet>
  );
}
