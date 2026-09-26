"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ErrorState, LoadingList } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@gymos/i18n";
import { dealErrorKey } from "@gymos/api/deals/errors";
import { createDeal } from "@gymos/api/deals/deals";

/** /sales/deals/new?lead=… or ?client=… : opens the lead's draft (fn_create_deal reuses an open one). */
export function NewDeal({ leadId, clientId }: { leadId?: string; clientId?: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (started.current || !(leadId || clientId)) return;
    started.current = true;
    createDeal({ leadId, clientId }).then((id) => router.replace(`/sales/deals/${id}`), setError);
  }, [leadId, clientId, router]);
  if (!leadId && !clientId) return <ErrorState title={t("deal.error.noTarget")} action={<Link href="/sales/pipeline" className={buttonVariants({ variant: "outline" })}>{t("action.openPipeline")}</Link>} />;
  if (error) return <ErrorState title={t(dealErrorKey(error))} action={<Link href="/sales/pipeline" className={buttonVariants({ variant: "outline" })}>{t("action.openPipeline")}</Link>} />;
  return <LoadingList rows={2} label={t("deal.creating")} />;
}
