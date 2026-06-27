import type { HTMLAttributes } from "react";

export function GlassCard({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-slate-400/10 bg-white/[0.04] backdrop-blur-xl transition-all duration-300 ${className}`}
      {...props}
    />
  );
}

export function GlassPanel({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-3xl border border-slate-400/10 bg-[#0F172A]/80 backdrop-blur-2xl shadow-[0_24px_80px_rgba(2,8,23,0.35)] ${className}`}
      {...props}
    />
  );
}
