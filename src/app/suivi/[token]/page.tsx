import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicTracking } from "@/domains/public-order/public-order.service";
import { TrackingAutoRefresh } from "@/features/public-order/tracking-auto-refresh";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Suivi de livraison", robots: { index: false, follow: false }, referrer: "no-referrer" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
const dateOnly = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });
const timeOnly = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", timeZone: "Europe/Paris" });

function promised(start: string | null, end: string | null) {
  if (!end) return null;
  const until = new Date(end);
  if (!start) return `Le ${dateOnly.format(until)}`;
  return `Le ${dateOnly.format(until)}, entre ${timeOnly.format(new Date(start))} et ${timeOnly.format(until)}`;
}

export default async function PublicTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tracking = await getPublicTracking(token);
  if (!tracking) notFound();
  const slot = promised(tracking.deliverySlotStart, tracking.requestedDeliveryDate);
  return (
    <main id="main-content" className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:py-12">
      <TrackingAutoRefresh />
      <div>
        <p className="text-sm text-muted-foreground">{tracking.companyName} · {tracking.reference}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{tracking.statusLabel}</h1>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Votre livraison</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(tracking.pickupCity || tracking.deliveryCity) && (
            <p>{[tracking.pickupCity, tracking.deliveryCity].filter(Boolean).join(" → ")}</p>
          )}
          {slot && <p>Prévue : {slot}</p>}
          {tracking.estimatedArrival && !tracking.completedAt && <p>Arrivée estimée : {dateTime.format(new Date(tracking.estimatedArrival))}</p>}
          {tracking.completedAt && <p>Terminée : {dateTime.format(new Date(tracking.completedAt))}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Étapes</CardTitle></CardHeader>
        <CardContent>
          {tracking.steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune étape pour le moment.</p>
          ) : (
            <ol className="space-y-3 text-sm">
              {tracking.steps.map((step) => (
                <li key={step.id} className="flex flex-wrap justify-between gap-x-4">
                  <span>{step.label}</span>
                  <time className="text-muted-foreground" dateTime={step.occurredAt}>{dateTime.format(new Date(step.occurredAt))}</time>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
