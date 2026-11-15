import { Skeleton } from '@/components/ui/skeleton';

export default function ChatLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="space-y-4 rounded-xl border border-border p-5 min-h-[40vh]">
        <div className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <Skeleton className="h-16 w-2/3 rounded-xl" />
        </div>
        <div className="flex gap-3 justify-end">
          <Skeleton className="h-12 w-1/2 rounded-xl" />
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}