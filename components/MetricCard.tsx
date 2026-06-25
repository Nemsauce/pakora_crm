import type { LucideIcon } from "lucide-react";
import Link from "next/link";

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  accent?: "primary" | "warning" | "danger" | "neutral";
  href?: string;
}

const accentClasses = {
  primary: "text-primary",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-muted"
};

export function MetricCard({ title, value, icon: Icon, accent = "primary", href }: MetricCardProps) {
  const content = (
    <div className="bg-white/[0.06] backdrop-blur-xl border border-slate-400/10 rounded-2xl hover:border-sky-400/30 hover:shadow-[0_0_20px_rgba(56,189,248,0.1)] transition-all duration-300 p-5 cursor-pointer">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted">{title}</p>
        <div className={accentClasses[accent]}>
          <Icon aria-hidden="true" className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-5 text-4xl font-bold tracking-normal text-slate-50">{value}</p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
