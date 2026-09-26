"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { t } from "@gymos/i18n";
import { cn } from "@/lib/utils";
import { ProductsEditor } from "./products-editor";
import { SettingsScreen } from "./settings-screen";

/** /admin/settings: rules and feature flags, and the product catalog. */
export function SettingsTabs() {
  const [tab, setTab] = useState<"rules" | "products">(useSearchParams().get("tab") === "products" ? "products" : "rules");
  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label={t("settings.title")} className="flex gap-1 border-b">
        {(["rules", "products"] as const).map((x) => (
          <button key={x} role="tab" type="button" aria-selected={tab === x} onClick={() => setTab(x)}
            className={cn("-mb-px min-h-tap border-b-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === x ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t(x === "rules" ? "settings.tab.rules" : "settings.tab.products")}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === "rules" ? <SettingsScreen /> : <ProductsEditor />}</div>
    </div>
  );
}
