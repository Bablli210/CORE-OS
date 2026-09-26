"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingList } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@gymos/i18n";
import { fetchSettings, settingsKeys } from "@gymos/api/admin/settings";
import { groupSettings } from "@gymos/api/admin/settings-model";
import { SettingRow } from "./setting-row";

/** /admin/settings: every `settings` key grouped by area, edited inline (feature flags live here, CLAUDE.md rule 9). */
export function SettingsScreen() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: settingsKeys.all, queryFn: fetchSettings });
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groupSettings((data ?? []).filter((r) => !q || r.key.includes(q) || r.description?.toLowerCase().includes(q)));
  }, [data, query]);

  if (isPending) return <LoadingList label={t("common.loading")} rows={6} />;
  if (isError)
    return <ErrorState title={t("settings.error.load")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />;

  return (
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
          <section key={g.id} aria-labelledby={`group-${g.id}`} className="rounded-lg border px-4">
            <h2 id={`group-${g.id}`} className="border-b py-3 font-semibold">
              {t(g.label)}
            </h2>
            <ul>
              {g.rows.map((row) => (
                <SettingRow key={row.key} row={row} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
