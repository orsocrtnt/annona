"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeliveryRouteDisplay } from "@/components/shared/delivery-route-display";
import { getCourierPickupStops } from "@/lib/order/courier-pickups";
import { useClaimDelivery } from "./hooks";
import type { DriverMission } from "./types";
import { formatClientFromParts } from "@/lib/format/person-labels";
import { Hand, Package } from "lucide-react";
import { toast } from "sonner";

function getClientName(mission: DriverMission) {
  return formatClientFromParts(mission.order.customer, mission.order.customerEmail);
}

interface AvailableMissionCardProps {
  mission: DriverMission;
}

export function AvailableMissionCard({ mission }: AvailableMissionCardProps) {
  const claim = useClaimDelivery();
  const courierPickups = getCourierPickupStops({
    deliveryCategory: mission.deliveryCategory,
    stops: mission.order.stops,
    pickupAddress: mission.pickupAddress,
    pickupCity: mission.pickupCity,
    pickupPostalCode: mission.pickupPostalCode,
    pickupInstructions: null,
  });

  const handleClaim = async () => {
    try {
      await claim.mutateAsync(mission.id);
      toast.success("Mission affectée", {
        description: "Confirmez sa prise en charge, puis démarrez quand vous êtes prêt.",
      });
    } catch (error) {
      toast.error("Affectation impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Card className="border-dashed">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{mission.reference}</span>
          <Badge variant="secondary">Disponible</Badge>
        </div>

        <div>
          <p className="font-medium">{getClientName(mission)}</p>
          <div className="mt-2">
            <DeliveryRouteDisplay
              category={mission.deliveryCategory}
              compact
              pickups={courierPickups.length ? courierPickups : undefined}
              pickup={
                !courierPickups.length && mission.pickupAddress
                  ? {
                      address: mission.pickupAddress,
                      city: mission.pickupCity,
                      postalCode: mission.pickupPostalCode,
                    }
                  : null
              }
              destination={{
                address: mission.address,
                city: mission.city,
                postalCode: mission.postalCode,
                instructions: mission.order.deliveryInstructions,
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          {mission.order.itemCount} colis
        </div>

        <Button
          variant="brand"
          size="sm"
          className="w-full"
          loading={claim.isPending}
          onClick={() => void handleClaim()}
        >
          <Hand className="mr-1.5 h-3.5 w-3.5" />
          Me l’affecter
        </Button>
      </CardContent>
    </Card>
  );
}
