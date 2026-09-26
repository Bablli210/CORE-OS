"use client";

import { useState } from "react";
import { t } from "@gymos/i18n";
import { cn } from "@/lib/utils";
import { ClientLoginForm } from "./client-login-form";
import { StaffLoginForm } from "./staff-login-form";

type Tab = "member" | "staff";

export function LoginTabs({ next }: { next?: string }) {
  const [tab, setTab] = useState<Tab>("member");
  const tabs: { id: Tab; label: string }[] = [
    { id: "member", label: t("login.tab.member") },
    { id: "staff", label: t("login.tab.staff") },
  ];
  return (
    <div className="grid gap-6">
      <div role="tablist" aria-label={t("login.title")} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            id={`tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            onClick={() => setTab(item.id)}
            className={cn(
              "min-h-10 rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === item.id ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "member" ? <ClientLoginForm next={next} /> : <StaffLoginForm next={next} />}
      </div>
    </div>
  );
}
