"use client";

import { Suspense, useState } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { WaitlistFunnelPanel } from "@/features/admin/waitlist/waitlist-funnel-panel";
import { WaitlistList } from "@/features/admin/waitlist/waitlist-list";
import type { FunnelPeriod } from "@/domains/growth/waitlist-funnel.service";

/** ADMIN-ESPACE lot 2 : entonnoir de /tarifs puis inscrits à la liste d'attente (super-administrateur). */
export default function AdminWaitlistPage() {
  const [days, setDays] = useState<FunnelPeriod>(30);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Commercial</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Liste d&apos;attente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inscriptions reçues sur la page Tarifs, à recontacter avant l&apos;ouverture, et le chemin des visiteurs jusqu&apos;au formulaire.
        </p>
      </header>
      <WaitlistFunnelPanel days={days} onDaysChange={setDays} />
      {/* `?q=` de la recherche globale : lu par la liste (useSearchParams), donc sous Suspense. */}
      <Suspense fallback={<PageSkeleton />}>
        <WaitlistList />
      </Suspense>
    </div>
  );
}
