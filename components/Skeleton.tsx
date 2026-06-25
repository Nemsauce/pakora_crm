export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.06] ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="bg-white/[0.04] backdrop-blur-xl border border-slate-400/10 rounded-2xl p-5">
      <SkeletonLine className="h-4 w-28" />
      <SkeletonLine className="mt-5 h-8 w-16" />
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="bg-white/[0.04] backdrop-blur-xl border border-slate-400/10 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-4 w-24" />
              <SkeletonLine className="mt-3 h-5 w-56 max-w-full" />
              <SkeletonLine className="mt-3 h-4 w-36" />
            </div>
            <SkeletonLine className="h-9 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
