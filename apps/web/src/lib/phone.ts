import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export type { CountryCode };

/** Egypt first: every phone input defaults to +20 (docs/06 #14). */
export const DEFAULT_COUNTRY: CountryCode = "EG";

/**
 * Normalizes what a person typed into E.164 (`+201011112222`), the only format we store (CLAUDE.md).
 * Local numbers are read in the picked country; numbers typed with + or 00 keep their own country.
 * Returns null when the input is not a valid number.
 */
export function toE164(input: string, country: CountryCode = DEFAULT_COUNTRY): string | null {
  const cleaned = input.trim().replace(/^00/, "+");
  if (!cleaned) return null;
  const parsed = parsePhoneNumberFromString(cleaned, country);
  return parsed?.isValid() ? parsed.number : null;
}

export function isE164(value: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(value) && toE164(value) === value;
}

/** Splits a stored E.164 number back into country + national digits for editing. */
export function fromE164(value: string): { country: CountryCode; national: string } | null {
  const parsed = value ? parsePhoneNumberFromString(value) : undefined;
  if (!parsed?.country) return null;
  return { country: parsed.country, national: parsed.formatNational() };
}

export type CountryOption = { code: CountryCode; name: string; dialCode: string };

/** Every country with its calling code, the default country first, the rest by name. */
export function countryOptions(locale = "en"): CountryOption[] {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const all = getCountries().map((code) => ({ code, name: names.of(code) ?? code, dialCode: `+${getCountryCallingCode(code)}` }));
  const first = all.filter((c) => c.code === DEFAULT_COUNTRY);
  const rest = all.filter((c) => c.code !== DEFAULT_COUNTRY).sort((a, b) => a.name.localeCompare(b.name, locale));
  return [...first, ...rest];
}
