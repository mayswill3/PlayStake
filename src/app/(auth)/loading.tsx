import { Skeleton } from '@/components/ui/Skeleton';

export default function AuthLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <Skeleton className="h-10 w-40 mb-8" />
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-1/3 mx-auto" />
      </div>
    </div>
  );
}
