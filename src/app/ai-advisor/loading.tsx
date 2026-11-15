import { Skeleton } from '@/components/ui/skeleton';

export default function AiAdvisorLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div className="space-y-4 rounded-xl border border-border p-5 min-h-[40vh]">
        <div className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <Skeleton className="h-20 w-2/3 rounded-xl" />
        </div>
        <div className="flex gap-3 justify-end">
          <Skeleton className="h-12 w-1/2 rounded-xl" />
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <Skeleton className="h-24 w-3/4 rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}