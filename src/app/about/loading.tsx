import { Skeleton } from '@/components/ui/skeleton';

export default function AboutLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="space-y-4 text-center">
        <Skeleton className="h-10 w-1/2 mx-auto" />
        <Skeleton className="h-4 w-2/3 mx-auto" />
        <Skeleton className="h-4 w-1/2 mx-auto" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <div className="space-y-3 rounded-xl border border-border p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </div>
  );
}