import type { CountryCode, CountryMode } from "@/lib/types";

export const COUNTRY_STORAGE_KEY = "pakora.country";

export const countryModes: CountryMode[] = ["todos", "CO", "MX"];

export function normalizeCountryMode(value?: string | null): CountryMode | null {
  if (!value) return null;

  const normalized = value.toUpperCase();
  if (normalized === "CO" || normalized === "MX") return normalized;
  if (value.toLowerCase() === "todos") return "todos";

  return null;
}

export function isConcreteCountry(mode: CountryMode): mode is CountryCode {
  return mode === "CO" || mode === "MX";
}

export function countryFlag(country?: string | null) {
  if (country === "CO") return "🇨🇴";
  if (country === "MX") return "🇲🇽";
  return "🌐";
}

export function countryLabel(mode?: string | null) {
  if (mode === "CO") return "Colombia";
  if (mode === "MX") return "México";
  return "Todos";
}

export function countryShortLabel(country?: string | null) {
  if (country === "CO" || country === "MX") return country;
  return "N/D";
}

export function countryQuery(mode: CountryMode) {
  return isConcreteCountry(mode) ? `pais=${mode}` : "";
}
