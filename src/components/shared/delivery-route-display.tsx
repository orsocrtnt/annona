import type { DeliveryCategory } from "@prisma/client";
import { MapPin, ArrowRight } from "lucide-react";
import { DELIVERY_CATEGORY_LABELS } from "@/lib/constants/delivery";
import { Badge } from "@/components/ui/badge";

export type RouteAddress = {
  label?: string | null;
  address: string;
  city?: string | null;
  postalCode?: string | null;
  instructions?: string | null;
};

interface DeliveryRouteDisplayProps {
  category: DeliveryCategory;
  pickup?: Omit<RouteAddress, "label"> | null;
  pickups?: RouteAddress[];
  destination: Omit<RouteAddress, "label">;
  compact?: boolean;
}

function formatAddress(parts: { address: string; city?: string | null; postalCode?: string | null }) {
  return [parts.address, parts.postalCode, parts.city].filter(Boolean).join(", ");
}

function resolvePickups(
  pickups: RouteAddress[] | undefined,
  pickup: Omit<RouteAddress, "label"> | null | undefined
): RouteAddress[] {
  if (pickups?.length) return pickups;
  if (pickup?.address) {
    return [{ label: "Collecte", ...pickup }];
  }
  return [];
}

function PickupCard({
  stop,
  index,
  total,
  compact,
}: {
  stop: RouteAddress;
  index: number;
  total: number;
  compact?: boolean;
}) {
  const title =
    stop.label?.trim() ||
    (total > 1 ? `Collecte ${index + 1}` : "Collecte");

  return (
    <div className={compact ? "rounded-lg border border-border p-2.5" : "rounded-lg border border-border p-3"}>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        {title}
      </p>
      <p className="font-medium">{stop.address}</p>
      <p className="text-muted-foreground">{formatAddress(stop)}</p>
      {stop.instructions && (
        <p className="mt-1 text-sm text-muted-foreground">{stop.instructions}</p>
      )}
    </div>
  );
}

export function DeliveryRouteDisplay({
  category,
  pickup,
  pickups,
  destination,
  compact,
}: DeliveryRouteDisplayProps) {
  const pickupList = resolvePickups(pickups, pickup);

  if (category === "COURIER" && pickupList.length > 0) {
    return (
      <div className={compact ? "space-y-2 text-sm" : "space-y-4"}>
        <Badge variant="brand">{DELIVERY_CATEGORY_LABELS.COURIER}</Badge>
        <div className="space-y-3">
          <div className="space-y-2">
            {pickupList.map((stop, index) => (
              <PickupCard
                key={`${stop.address}-${index}`}
                stop={stop}
                index={index}
                total={pickupList.length}
                compact={compact}
              />
            ))}
          </div>
          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-brand" />
          </div>
          <div className={compact ? "rounded-lg border border-border p-2.5" : "rounded-lg border border-border p-3"}>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Adresse de livraison
            </p>
            <p className="font-medium">{destination.address}</p>
            <p className="text-muted-foreground">{formatAddress(destination)}</p>
            {destination.instructions && (
              <p className="mt-1 text-sm text-muted-foreground">{destination.instructions}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "text-sm" : "space-y-2"}>
      {!compact && <Badge variant="secondary">{DELIVERY_CATEGORY_LABELS.STANDARD}</Badge>}
      <p className="font-medium">{destination.address}</p>
      <p className="text-muted-foreground">{formatAddress(destination)}</p>
      {destination.instructions && (
        <p className="text-muted-foreground">{destination.instructions}</p>
      )}
    </div>
  );
}
