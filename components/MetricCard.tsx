import { GlassCard } from "@/components/Glass";
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
    <GlassCard
      className="group min-h-[7.25rem] p-5"
      hover={Boolean(href)}
      variant="metric"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted">{title}</p>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-400/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition group-hover:border-sky-400/30 ${accentClasses[accent]}`}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-5 text-4xl font-bold tracking-normal text-slate-50">{value}</p>
    </GlassCard>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-2xl">
        {content}
      </Link>
    );
  }

  return content;
}
