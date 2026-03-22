import { SkeletonCard } from '@/components/ui/Skeleton';

export default function DeveloperLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 lg:p-6">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-sm bg-surface-800" />
        <div className="h-4 w-72 animate-pulse rounded-sm bg-surface-800" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
