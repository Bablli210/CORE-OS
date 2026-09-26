"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoadingList } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { coachingErrorKey } from "@gymos/api/sessions/errors";
import { t, type MessageKey } from "@gymos/i18n";
import { checkIn, type CheckInResult } from "@gymos/api/training/client";

/** /c/here?b=<branch>&k=<code> — the page the kiosk's QR opens on the member's phone: checks them in once. */
export function HereScreen() {
  const params = useSearchParams();
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const b = params.get("b");
    const k = params.get("k");
    if (!b || !k) return setResult({ ok: false, reason: "bad_code" });
    checkIn(b, k).then(setResult, setError);
  }, [params]);

  if (!result && !error) return <LoadingList label={t("here.checking")} rows={1} />;
  const ok = result?.ok;
  return (
    <section role={ok ? "status" : "alert"} data-testid="here-result" data-ok={!!ok} className="mx-auto grid max-w-md justify-items-center gap-3 rounded-xl border p-6 text-center">
      {ok ? <CheckCircle2 aria-hidden className="size-12 text-success" /> : <CircleAlert aria-hidden className="size-12 text-destructive" />}
      <p className="text-xl font-semibold">
        {ok ? (result?.duplicate ? t("home.alreadyIn") : t("home.checkedIn", { branch: result?.branch_name ?? "" })) : result?.reason ? t(`home.reason.${result.reason}` as MessageKey) : t(coachingErrorKey(error))}
      </p>
      <Link href={ok ? "/c/workout" : "/c/credits"} className={buttonVariants()}>{ok ? t("home.startWorkout") : t("nav.credits")}</Link>
    </section>
  );
}
