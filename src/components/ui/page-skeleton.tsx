import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Chargement du contenu" className="space-y-6">
      <span className="sr-only">Chargement du contenu…</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
