"use client";

import {
  COUNTRY_STORAGE_KEY,
  isConcreteCountry,
  normalizeCountryMode
} from "@/lib/country";
import type { CountryCode, CountryMode } from "@/lib/types";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

interface CountryContextValue {
  countryMode: CountryMode;
  concreteCountry: CountryCode | null;
  setCountryMode: (mode: CountryMode) => void;
}

const CountryContext = createContext<CountryContextValue | null>(null);

function isCountryScopedPath(pathname: string) {
  return pathname === "/ordenes" || pathname === "/tareas";
}

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [countryMode, setCountryModeState] = useState<CountryMode>("todos");
  const [ready, setReady] = useState(false);

  const syncUrl = useCallback(
    (mode: CountryMode) => {
      if (typeof window === "undefined" || !isCountryScopedPath(pathname)) return;

      const params = new URLSearchParams(window.location.search);
      if (isConcreteCountry(mode)) {
        params.set("pais", mode);
      } else {
        params.delete("pais");
      }

      const query = params.toString();
      const nextUrl = query ? `${pathname}?${query}` : pathname;
      const currentUrl = `${pathname}${window.location.search}`;

      if (nextUrl !== currentUrl) {
        router.replace(nextUrl, { scroll: false });
      }
    },
    [pathname, router]
  );

  const setCountryMode = useCallback(
    (mode: CountryMode) => {
      setCountryModeState(mode);
      window.localStorage.setItem(COUNTRY_STORAGE_KEY, mode);
      syncUrl(mode);
    },
    [syncUrl]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = normalizeCountryMode(params.get("pais"));
    const fromStorage = normalizeCountryMode(window.localStorage.getItem(COUNTRY_STORAGE_KEY));
    const initialMode = fromUrl ?? fromStorage ?? "todos";

    setCountryModeState(initialMode);
    window.localStorage.setItem(COUNTRY_STORAGE_KEY, initialMode);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    const fromUrl = normalizeCountryMode(new URLSearchParams(window.location.search).get("pais"));
    if (fromUrl && fromUrl !== countryMode) {
      setCountryModeState(fromUrl);
      window.localStorage.setItem(COUNTRY_STORAGE_KEY, fromUrl);
      return;
    }

    syncUrl(countryMode);
  }, [countryMode, pathname, ready, syncUrl]);

  const value = useMemo<CountryContextValue>(
    () => ({
      countryMode,
      concreteCountry: isConcreteCountry(countryMode) ? countryMode : null,
      setCountryMode
    }),
    [countryMode, setCountryMode]
  );

  if (!ready) return null;

  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

export function useCountry() {
  const context = useContext(CountryContext);
  if (!context) {
    throw new Error("useCountry must be used within CountryProvider");
  }

  return context;
}
