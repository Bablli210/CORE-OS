"use client";

import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import { PhoneInput } from "@/components/phone-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useMe } from "@/features/auth/me-context";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { coachingErrorKey } from "../errors";

type CheckIn = {
  ok: boolean;
  reason?: "no_active_entitlement" | "not_found";
  duplicate?: boolean;
  client_id?: string;
  first_name?: string;
  balances?: { coach_name: string; balance: number; next_expiry: string }[];
  membership_ends_at?: string | null;
  next_session?: { starts_at: string; coach_name: string } | null;
  pt_branch?: string | null;
  rep_name?: string | null;
};

const RESET_MS = 12_000;

async function checkIn(phone: string, branch: string): Promise<CheckIn> {
  const { data, error } = await createClient().rpc("fn_kiosk_check_in", { p_phone: phone, p_branch: branch });
  if (error) throw error;
  return data as unknown as CheckIn;
}
async function notifySales(client: string, branch: string): Promise<{ notified: string }> {
  const { data, error } = await createClient().rpc("fn_kiosk_notify_sales", { p_client_id: client, p_branch: branch });
  if (error) throw error;
  return data as unknown as { notified: string };
}

/** /checkin — reception tablet (docs/04): the member types their phone; admitted or refused with a way forward. */
export function KioskScreen() {
  const me = useMe();
  const branch = me.active.branchId ?? me.branchIds[0];
  const [phone, setPhone] = useState("");
  const [round, setRound] = useState(0);
  const check = useMutation({ mutationFn: () => checkIn(phone, branch) });
  const notify = useMutation({ mutationFn: (client: string) => notifySales(client, branch) });
  const r = check.data;
  const reset = () => { setPhone(""); setRound((n) => n + 1); check.reset(); notify.reset(); };

  // the next member should find an empty screen
  useEffect(() => {
    if (!r) return;
    const timer = window.setTimeout(reset, RESET_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r, notify.data]);

  return (
    <div className="mx-auto grid w-full max-w-lg gap-6 py-4">
      <div className="grid gap-1 text-center">
        <h1 className="text-2xl font-semibold">{t("kiosk.title")}</h1>
        <p className="text-muted-foreground">{t("kiosk.subtitle", { branch: me.branches.find((b) => b.id === branch)?.name ?? "" })}</p>
      </div>
      {!r ? (
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (phone) check.mutate(); }}>
          <div className="grid gap-2">
            <Label htmlFor="kiosk-phone">{t("kiosk.phone")}</Label>
            <PhoneInput key={round} id="kiosk-phone" value={phone} onChange={setPhone} autoFocus />
          </div>
          {check.isError ? <p role="alert" className="text-sm text-destructive">{t(coachingErrorKey(check.error))}</p> : null}
          <Button type="submit" size="block" className="min-h-14 text-base" disabled={!phone || check.isPending}>{t("kiosk.checkIn")}</Button>
        </form>
      ) : r.ok ? (
        <section role="status" data-testid="kiosk-result" data-ok="true" className="grid justify-items-center gap-3 rounded-xl border border-success bg-success/10 p-6 text-center">
          <CheckCircle2 aria-hidden className="size-12 text-success" />
          <p className="text-2xl font-semibold">{r.duplicate ? t("kiosk.already", { name: r.first_name ?? "" }) : t("kiosk.welcome", { name: r.first_name ?? "" })}</p>
          {r.balances?.map((b) => <p key={b.coach_name}>{t("kiosk.balance", { n: b.balance, coach: b.coach_name })}</p>)}
          {r.membership_ends_at ? <p className="text-muted-foreground">{t("kiosk.membership", { date: formatDate(r.membership_ends_at) })}</p> : null}
          {r.next_session ? <p className="text-muted-foreground">{t("kiosk.next", { when: formatDateTime(r.next_session.starts_at), coach: r.next_session.coach_name })}</p> : null}
          <Button variant="outline" onClick={reset}>{t("kiosk.nextMember")}</Button>
        </section>
      ) : r.reason === "not_found" ? (
        <section role="alert" data-testid="kiosk-result" data-ok="false" className="grid justify-items-center gap-3 rounded-xl border p-6 text-center">
          <SearchX aria-hidden className="size-12 text-muted-foreground" />
          <p className="text-xl font-semibold">{t("kiosk.notFound")}</p>
          <p className="text-muted-foreground">{t("kiosk.notFoundBody")}</p>
          <Button variant="outline" onClick={reset}>{t("kiosk.tryAgain")}</Button>
        </section>
      ) : (
        <section role="alert" data-testid="kiosk-result" data-ok="false" className="grid justify-items-center gap-3 rounded-xl border border-destructive bg-destructive/5 p-6 text-center">
          <CircleAlert aria-hidden className="size-12 text-destructive" />
          <p className="text-2xl font-semibold">{t("kiosk.refused", { name: r.first_name ?? "" })}</p>
          <p>{r.pt_branch ? t("kiosk.ptOtherBranch", { branch: r.pt_branch }) : t("kiosk.refusedBody")}</p>
          {notify.data ? (
            <p className="font-medium text-success">{t("kiosk.notified", { name: notify.data.notified })}</p>
          ) : (
            <Button size="block" className="min-h-14 text-base" disabled={notify.isPending} onClick={() => r.client_id && notify.mutate(r.client_id)}>{t("kiosk.notifySales")}</Button>
          )}
          {notify.isError ? <p role="alert" className="text-sm text-destructive">{t(coachingErrorKey(notify.error))}</p> : null}
          <Button variant="outline" onClick={reset}>{t("kiosk.nextMember")}</Button>
        </section>
      )}
    </div>
  );
}
