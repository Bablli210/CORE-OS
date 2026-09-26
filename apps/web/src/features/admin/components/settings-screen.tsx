"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingList } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@gymos/i18n";
import { fetchSettings, settingsKeys } from "@gymos/api/admin/settings";
import { ADVANCED_KEYS, groupSettings, settingLabel } from "@gymos/api/admin/settings-model";
import { SettingRow } from "./setting-row";

/** /admin/settings: every `settings` key grouped by area, edited inline (feature flags live here, CLAUDE.md rule 9). */
export function SettingsScreen() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: settingsKeys.all, queryFn: fetchSettings });
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (data ?? []).filter((r) => !q || r.key.includes(q) || settingLabel(r.key).toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
    const main = groupSettings(rows.filter((r) => !ADVANCED_KEYS.has(r.key)));
    const advanced = rows.filter((r) => ADVANCED_KEYS.has(r.key));
    return advanced.length ? [...main, { id: "advanced", label: "settings.advanced" as const, rows: advanced }] : main;
  }, [data, query]);

  if (isPending) return <LoadingList label={t("common.loading")} rows={6} />;
  if (isError)
    return <ErrorState title={t("settings.error.load")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start">
      <nav aria-label={t("settings.jump")} className="-mx-4 overflow-x-auto px-4 lg:sticky lg:top-20 lg:mx-0 lg:px-0">
        <ul className="flex gap-2 lg:grid lg:gap-1">
          {groups.map((g) => (
            <li key={g.id}>
              <a href={`#group-${g.id}`} className="block whitespace-nowrap rounded-full border bg-card px-3 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:rounded-md lg:border-0 lg:bg-transparent lg:px-3">
                {t(g.label)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="grid gap-6">
        <label className="relative max-w-md">
          <span className="sr-only">{t("common.search")}</span>
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("settings.search")} className="ps-9" />
        </label>
        {groups.length === 0 ? (
          <EmptyState icon={SlidersHorizontal} title={t("settings.noMatch")} action={<Button variant="outline" onClick={() => setQuery("")}>{t("common.clearFilters")}</Button>} />
        ) : (
          groups.map((g) => (
            <section key={g.id} id={`group-${g.id}`} aria-labelledby={`group-${g.id}-title`} className="scroll-mt-20 rounded-lg border bg-card px-4">
              <div className="border-b py-3">
                <h2 id={`group-${g.id}-title`} className="font-semibold">{t(g.label)}</h2>
                {g.id === "advanced" ? <p className="text-sm text-muted-foreground">{t("settings.advancedHint")}</p> : null}
              </div>
              <ul>
                {g.rows.map((row) => (
                  <SettingRow key={row.key} row={row} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
