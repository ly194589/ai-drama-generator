import { Skeleton } from '@/components/ui/skeleton';

export default function ConfigLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-3xl">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-60" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-4 rounded-xl border border-border p-5">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      ))}
    </div>
  );
}