"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ProductsEditor } from "./products-editor";
import { SettingsScreen } from "./settings-screen";

/** /admin/settings: rules and feature flags, and the product catalog. */
export function SettingsTabs() {
  const [tab, setTab] = useState<"rules" | "products">("rules");
  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label={t("settings.title")} className="flex gap-1">
        {(["rules", "products"] as const).map((x) => (
          <button key={x} role="tab" type="button" aria-selected={tab === x} onClick={() => setTab(x)}
            className={cn("min-h-10 rounded-md px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === x ? "bg-primary text-primary-foreground" : "bg-muted")}>
            {t(x === "rules" ? "settings.tab.rules" : "settings.tab.products")}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === "rules" ? <SettingsScreen /> : <ProductsEditor />}</div>
    </div>
  );
}
