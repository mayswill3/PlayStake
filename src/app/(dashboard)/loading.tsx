import { SkeletonCard } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 lg:p-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-sm bg-surface-800" />
        <div className="h-4 w-64 animate-pulse rounded-sm bg-surface-800" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="rounded-sm border border-white/8 bg-surface-900 p-6 space-y-4">
        <div className="h-6 w-32 animate-pulse rounded-sm bg-surface-800" />
        <div className="h-4 w-full animate-pulse rounded-sm bg-surface-800" />
        <div className="h-4 w-full animate-pulse rounded-sm bg-surface-800" />
        <div className="h-4 w-3/4 animate-pulse rounded-sm bg-surface-800" />
      </div>
    </div>
  );
}
