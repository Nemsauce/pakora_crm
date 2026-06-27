import { GlassCard } from "@/components/Glass";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
}

export function EmptyState({ icon: Icon, title, message }: EmptyStateProps) {
  return (
    <GlassCard className="px-6 py-10 text-center" hover={false} variant="panel">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-white/[0.07] text-primary shadow-[0_0_28px_rgba(56,189,248,0.14)]">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-50">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{message}</p>
    </GlassCard>
  );
}
