"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Json } from "@/lib/database.types";
import { t, type MessageKey } from "@/lib/i18n";
import { settingsKeys, updateSetting } from "../queries/settings";
import { humanizeKey, parseTiers, serializeTiers, settingKind, validateTiers, type SettingRow as Row, type Tier } from "../settings-model";
import { TiersEditor } from "./tiers-editor";

/** One setting with an editor for its type. Saves through fn_update_setting; shows saved / error state inline. */
export function SettingRow({ row }: { row: Row }) {
  const kind = settingKind(row.key, row.value);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string>(kind === "json" ? JSON.stringify(row.value, null, 2) : String(row.value ?? ""));
  const [tiers, setTiers] = useState<Tier[]>(() => parseTiers(row.value));
  const [localError, setLocalError] = useState<MessageKey | null>(null);
  const save = useMutation({
    mutationFn: (value: Json) => updateSetting(row.key, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.all }),
  });
  const id = `setting-${row.key.replace(/\W/g, "-")}`;

  const dirty =
    kind === "tiers" ? JSON.stringify(serializeTiers(tiers)) !== JSON.stringify(row.value) : kind !== "boolean" && draft !== (kind === "json" ? JSON.stringify(row.value, null, 2) : String(row.value ?? ""));

  function submit() {
    setLocalError(null);
    let value: Json;
    if (kind === "tiers") {
      const problem = validateTiers(tiers);
      if (problem) return setLocalError(problem);
      value = serializeTiers(tiers);
    } else if (kind === "number") {
      if (draft.trim() === "" || !Number.isFinite(Number(draft))) return setLocalError("settings.error.number");
      value = Number(draft);
    } else if (kind === "json") {
      try {
        value = JSON.parse(draft) as Json;
      } catch {
        return setLocalError("settings.error.json");
      }
    } else value = draft;
    save.mutate(value);
  }

  return (
    <li className="grid gap-2 border-b py-4 last:border-0 md:grid-cols-[1fr_minmax(0,22rem)] md:gap-6" data-testid={`setting-${row.key}`}>
      <div className="grid gap-1">
        <label htmlFor={id} id={`${id}-label`} className="font-medium">
          {humanizeKey(row.key)}
        </label>
        <code className="text-xs text-muted-foreground">{row.key}</code>
        {row.description ? <p className="text-sm text-muted-foreground">{row.description}</p> : null}
      </div>
      <div className="grid gap-2">
        {kind === "boolean" ? (
          <Switch id={id} aria-labelledby={`${id}-label`} checked={row.value === true} disabled={save.isPending} onCheckedChange={(v) => save.mutate(v)} />
        ) : kind === "tiers" ? (
          <TiersEditor id={id} tiers={tiers} onChange={setTiers} />
        ) : kind === "json" ? (
          <Textarea id={id} value={draft} onChange={(e) => setDraft(e.target.value)} />
        ) : (
          <Input id={id} type={kind === "number" ? "number" : "text"} inputMode={kind === "number" ? "decimal" : undefined} step="any" value={draft} onChange={(e) => setDraft(e.target.value)} />
        )}
        {dirty ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={save.isPending}>
              {t("common.save")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(kind === "json" ? JSON.stringify(row.value, null, 2) : String(row.value ?? ""));
                setTiers(parseTiers(row.value));
                setLocalError(null);
              }}
            >
              {t("common.cancel")}
            </Button>
          </div>
        ) : null}
        <p aria-live="polite" className="text-sm">
          {localError ? <span className="text-destructive">{t(localError)}</span> : save.isError ? <span className="text-destructive">{t("settings.error.save")}</span> : save.isSuccess && !dirty ? <span className="text-success">{t("settings.saved")}</span> : null}
        </p>
      </div>
    </li>
  );
}
