"use client";

import { CalendarPlus, Flag } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ErrorState, LoadingList } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { t, type MessageKey } from "@gymos/i18n";
import { cn } from "@/lib/utils";
import { useCoachClient } from "@gymos/api/coaching/use-coaching";
import { ClientHeader } from "./client-header";
import { FlagSheet } from "./flag-sheet";
import { LogsTab, OverviewTab } from "./client-overview";
import { NotesTab, ProgramTab } from "./client-program-notes";
import { SessionsTab } from "./client-sessions";

const TABS = ["overview", "sessions", "program", "logs", "notes"] as const;
type Tab = (typeof TABS)[number];

/** /coach/clients/[id] — one client for the coach (docs/04). The tab lives in the URL (?tab=). */
export function ClientScreen({ id }: { id: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "overview";
  const { data: c, isPending, isError, refetch } = useCoachClient(id);
  const [flagging, setFlagging] = useState(false);
  const [notice, setNotice] = useState("");

  if (isPending) return <LoadingList label={t("common.loading")} />;
  if (isError || !c) {
    return <ErrorState title={t("client.error.load")} body={t("coachClient.errorBody")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />;
  }

  return (
    <div className="grid gap-4">
      <ClientHeader client={c} />
      <div className="flex flex-col gap-2 md:flex-row">
        <Link href={`/coach/schedule?client=${c.id}`} className={cn(buttonVariants(), "w-full md:w-auto")}><CalendarPlus aria-hidden />{t("coachClient.addToWeek")}</Link>
        <Button variant="outline" className="w-full md:w-auto" onClick={() => setFlagging(true)}><Flag aria-hidden />{t("coachClient.flag")}</Button>
      </div>
      <p role="status" className="min-h-5 text-sm text-success">{notice}</p>

      <div role="tablist" aria-label={t("coachClient.tabs")} className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => router.replace(`${pathname}${k === "overview" ? "" : `?tab=${k}`}`, { scroll: false })}
            className={cn("min-h-tap whitespace-nowrap border-b-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === k ? "border-primary font-medium" : "border-transparent text-muted-foreground")}
          >
            {t(`coachClient.tab.${k}` as MessageKey)}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "overview" ? <OverviewTab client={c} /> : null}
        {tab === "sessions" ? <SessionsTab client={c} onNotice={setNotice} /> : null}
        {tab === "program" ? <ProgramTab client={c} /> : null}
        {tab === "logs" ? <LogsTab client={c} /> : null}
        {tab === "notes" ? <NotesTab client={c} /> : null}
      </div>
      {flagging ? <FlagSheet clientId={c.id} name={c.full_name} onClose={() => setFlagging(false)} onDone={() => { setFlagging(false); setNotice(t("coachClient.flagged")); }} /> : null}
    </div>
  );
}
