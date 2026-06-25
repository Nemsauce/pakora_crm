import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
}

export function EmptyState({ icon: Icon, title, message }: EmptyStateProps) {
  return (
    <div className="bg-white/[0.04] backdrop-blur-xl border border-slate-400/10 rounded-2xl px-6 py-10 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-white/[0.04] text-primary">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-50">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{message}</p>
    </div>
  );
}
