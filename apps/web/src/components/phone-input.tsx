"use client";

import { useMemo, useState } from "react";
import { inputClass } from "@/components/ui/input";
import { t } from "@gymos/i18n";
import { countryOptions, DEFAULT_COUNTRY, fromE164, toE164, type CountryCode } from "@gymos/api/phone";
import { cn } from "@/lib/utils";

type PhoneInputProps = {
  id: string;
  /** E.164 when valid; otherwise whatever was typed (so form validation can flag it). */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  defaultCountry?: CountryCode;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
  disabled?: boolean;
};

/**
 * docs/04 `PhoneInput`: country-code picker (default Egypt, +20) + number. Emits E.164 as soon as the number is
 * valid, so `01011112222` becomes `+201011112222` and a Saudi `0501234567` with 🇸🇦 becomes `+966501234567`.
 */
export function PhoneInput({ id, value, onChange, onBlur, defaultCountry = DEFAULT_COUNTRY, invalid, describedBy, autoFocus, disabled }: PhoneInputProps) {
  const initial = useMemo(() => fromE164(value), []); // eslint-disable-line react-hooks/exhaustive-deps -- initial value only
  const [country, setCountry] = useState<CountryCode>(initial?.country ?? defaultCountry);
  const [text, setText] = useState(initial?.national ?? value);
  const options = useMemo(() => countryOptions(), []);
  const e164 = toE164(text, country);

  function emit(nextText: string, nextCountry: CountryCode) {
    onChange(toE164(nextText, nextCountry) ?? nextText.trim());
  }

  return (
    <div className="grid gap-1">
      <div className="flex gap-2">
        <select
          aria-label={t("phone.country")}
          value={country}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value as CountryCode;
            setCountry(next);
            emit(text, next);
          }}
          className={cn(inputClass, "w-28 shrink-0 pe-2")}
        >
          {options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.code} {o.dialCode}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          value={text}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy ?? `${id}-e164`}
          placeholder={t("phone.placeholder")}
          onBlur={onBlur}
          onChange={(e) => {
            setText(e.target.value);
            emit(e.target.value, country);
          }}
          className={cn(inputClass, "text-start")}
        />
      </div>
      <p id={`${id}-e164`} className="text-xs text-muted-foreground" aria-live="polite">
        {e164 ? t("phone.savedAs", { number: e164 }) : " "}
      </p>
    </div>
  );
}
