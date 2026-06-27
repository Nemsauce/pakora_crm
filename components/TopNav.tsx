"use client";

import { CountryToggle } from "@/components/CountryToggle";
import { BarChart3, CheckSquare, Package2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/ordenes", label: "Órdenes", icon: Package2 },
  { href: "/tareas", label: "Tareas", icon: CheckSquare }
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-[#020817]/80 backdrop-blur-xl border-b border-slate-400/10">
      <div className="flex h-16 w-full items-center justify-between px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/30 bg-primary/[0.15] text-sm font-extrabold text-primary">
            P
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold tracking-normal text-slate-50">Pakora</span>
            <span className="rounded-full border border-slate-400/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold uppercase text-muted">
              CRM
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active ? "text-slate-50" : "text-muted hover:text-slate-50"
                }`}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <CountryToggle />
          <div className="hidden h-8 items-center rounded-full border border-slate-400/10 bg-white/[0.04] px-3 text-xs font-medium text-muted lg:flex">
            Operación COD
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-primary/[0.15] text-xs font-semibold text-primary">
            PA
          </div>
        </div>
      </div>

      <nav className="grid grid-cols-3 border-t border-border px-8 py-2 md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                active ? "bg-primary/[0.15] text-primary" : "text-muted"
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
