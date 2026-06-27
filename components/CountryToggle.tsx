"use client";

import { useCountry } from "@/components/CountryProvider";
import { countryFlag, countryLabel, countryModes } from "@/lib/country";

export function CountryToggle() {
  const { countryMode, setCountryMode } = useCountry();

  return (
    <div className="flex rounded-2xl border border-slate-400/10 bg-white/[0.04] p-1 backdrop-blur-xl">
      {countryModes.map((mode) => {
        const active = countryMode === mode;

        return (
          <button
            key={mode}
            type="button"
            onClick={() => setCountryMode(mode)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition sm:px-3 ${
              active
                ? "bg-sky-400 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.22)]"
                : "text-muted hover:bg-white/[0.05] hover:text-slate-50"
            }`}
          >
            <span aria-hidden="true">{countryFlag(mode)}</span>
            <span className="hidden sm:inline">{countryLabel(mode)}</span>
            <span className="sm:hidden">{mode === "todos" ? "All" : mode}</span>
          </button>
        );
      })}
    </div>
  );
}
