"use client";

import { inputClass } from "@/components/ui/input";
import { t, type MessageKey } from "@gymos/i18n";
import { cn } from "@/lib/utils";
import type { Answer, FieldDef } from "../steps";

const chip = (on: boolean) =>
  cn(
    "min-h-tap rounded-full border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
  );

/** Values like "fat_loss" show their opt.* label; numbers show as-is. */
function optLabel(v: string | number) {
  if (typeof v === "number") return String(v);
  const key = `opt.${v}` as MessageKey;
  const label = t(key);
  return label === key ? v : label;
}

/** One wizard field; big touch targets (chips, yes/no) for one-handed use at 360px. */
export function WizardField({ field, value, onChange, invalid }: { field: FieldDef; value: Answer | undefined; onChange: (v: Answer) => void; invalid: boolean }) {
  const id = `f-${field.name}`;
  const label = t(`wizard.q.${field.name}` as MessageKey);
  const error = invalid ? <p role="alert" className="text-sm text-destructive">{t("wizard.required")}</p> : null;

  if (field.type === "text" || field.type === "date")
    return (
      <div className="grid gap-2">
        <label htmlFor={id} className="font-medium">{label}{field.required ? null : <span className="text-muted-foreground"> {t("wizard.optional")}</span>}</label>
        <input id={id} type={field.type} className={inputClass} value={(value as string) ?? ""} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value)} />
        {error}
      </div>
    );

  if (field.type === "check")
    return (
      <div className="grid gap-2">
        <label className="flex min-h-tap items-start gap-3 rounded-md border p-3">
          <input type="checkbox" className="mt-1 size-5 accent-primary" checked={value === true} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.checked)} />
          <span>{label}</span>
        </label>
        {error}
      </div>
    );

  if (field.type === "parq") {
    const answers = (value as Record<string, boolean>) ?? {};
    return (
      <fieldset className="grid gap-3">
        <legend className="mb-1 font-medium">{label}</legend>
        {field.questions.map((q) => (
          <div key={q} className="grid gap-2 rounded-md border p-3">
            <span className="text-sm">{t(`wizard.parq.${q}` as MessageKey)}</span>
            <YesNo label={t(`wizard.parq.${q}` as MessageKey)} value={answers[q]} onChange={(v) => onChange({ ...answers, [q]: v })} />
          </div>
        ))}
        {error}
      </fieldset>
    );
  }

  const options: (string | number)[] = "options" in field ? field.options : [];
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 font-medium">{label}{field.required ? null : <span className="text-muted-foreground"> {t("wizard.optional")}</span>}</legend>
      {field.type === "yesno" ? (
        <YesNo label={label} value={value as boolean | undefined} onChange={onChange} />
      ) : (
        <div className="flex flex-wrap gap-2" role={field.type === "multi" ? "group" : "radiogroup"} aria-label={label}>
          {options.map((o) => {
            const on = field.type === "multi" ? Array.isArray(value) && value.includes(String(o)) : value === o;
            return (
              <button
                key={o}
                type="button"
                role={field.type === "multi" ? "checkbox" : "radio"}
                aria-checked={on}
                className={chip(on)}
                onClick={() => {
                  if (field.type === "multi") {
                    const cur = Array.isArray(value) ? value : [];
                    onChange(on ? cur.filter((x) => x !== o) : [...cur, String(o)]);
                  } else onChange(o);
                }}
              >
                {optLabel(o)}
              </button>
            );
          })}
        </div>
      )}
      {error}
    </fieldset>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={label}>
      {[true, false].map((v) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value === v} className={chip(value === v)} onClick={() => onChange(v)}>
          {v ? t("common.yes") : t("common.no")}
        </button>
      ))}
    </div>
  );
}
