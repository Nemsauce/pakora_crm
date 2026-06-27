import type { CountryCode } from "@/lib/types";

const countryData: Record<CountryCode, { flag: string; label: string }> = {
  CO: { flag: "🇨🇴", label: "CO" },
  MX: { flag: "🇲🇽", label: "MX" }
};

interface CountryBadgeProps {
  country?: string | null;
}

export function CountryBadge({ country }: CountryBadgeProps) {
  const normalized = country === "CO" || country === "MX" ? country : null;
  const data = normalized ? countryData[normalized] : { flag: "🌐", label: "N/D" };

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-400/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-slate-200 backdrop-blur-xl">
      <span aria-hidden="true">{data.flag}</span>
      {data.label}
    </span>
  );
}
