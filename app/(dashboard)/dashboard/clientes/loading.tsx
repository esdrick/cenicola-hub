import { Skeleton } from "@/components/ui/skeleton";

export default function ClientesLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Search */}
      <Skeleton className="h-9 w-full max-w-xs" />

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b px-4 py-3 grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4" />
          ))}
        </div>
        <div className="divide-y">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="grid grid-cols-4 gap-4 px-4 py-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-4" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
