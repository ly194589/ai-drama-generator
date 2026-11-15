import { Skeleton } from '@/components/ui/skeleton';

export default function SolutionLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="space-y-4 text-center">
        <Skeleton className="h-10 w-2/3 mx-auto" />
        <Skeleton className="h-4 w-1/2 mx-auto" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border p-5">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}