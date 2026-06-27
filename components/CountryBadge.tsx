import { countryFlag, countryShortLabel } from "@/lib/country";

interface CountryBadgeProps {
  country?: string | null;
}

export function CountryBadge({ country }: CountryBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-400/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-slate-200 backdrop-blur-xl">
      <span aria-hidden="true">{countryFlag(country)}</span>
      {countryShortLabel(country)}
    </span>
  );
}
