import { Skeleton } from "@/components/ui/skeleton";

export default function InventarioLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 w-fit rounded-lg border bg-gray-50 p-1">
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b px-4 py-3 grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4" />
          ))}
        </div>
        <div className="divide-y">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-4 px-4 py-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-4" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
