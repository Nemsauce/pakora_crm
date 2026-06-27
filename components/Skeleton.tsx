import { GlassCard } from "@/components/Glass";

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${className}`}
    />
  );
}

export function CardSkeleton() {
  return (
    <GlassCard className="p-5" hover={false} variant="metric">
      <SkeletonLine className="h-4 w-28" />
      <SkeletonLine className="mt-5 h-8 w-16" />
    </GlassCard>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <GlassCard key={index} className="p-4" hover={false} variant="task">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-4 w-24" />
              <SkeletonLine className="mt-3 h-5 w-56 max-w-full" />
              <SkeletonLine className="mt-3 h-4 w-36" />
            </div>
            <SkeletonLine className="h-9 w-24" />
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
