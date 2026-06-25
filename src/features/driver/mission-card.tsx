"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeliveryStatusBadge } from "@/features/client-portal/status-badges";
import { useStartMission, useUpdateMissionStatus } from "./hooks";
import type { DriverMission } from "./types";
import {
  PurchaseValidationDialog,
  missionNeedsPurchaseValidation,
} from "./purchase-validation-dialog";
import { LocationConfirmationDialog } from "./location-confirmation-dialog";
import { checkMissionLocationProximity } from "./mission-location-guard";
import { DriverApiError } from "./api";
import { getCurrentDriverPosition, type ProximityTargetKind } from "@/lib/maps/driver-proximity";
import { DeliveryRouteDisplay } from "@/components/shared/delivery-route-display";
import { getCourierPickupStops } from "@/lib/order/courier-pickups";
import { canNavigateMission } from "@/features/driver/driver-navigation-utils";
import { MissionStepper } from "@/features/driver/mission-stepper";
import {
  Package,
  Navigation,
  CheckCircle,
  ShoppingCart,
  Truck,
  PackageCheck,
  Play,
} from "lucide-react";
import { formatClientFromParts } from "@/lib/format/person-labels";
import { toast } from "sonner";

function MissionNavigateButton({ missionId }: { missionId: string }) {
  return (
    <Button variant="outline" size="lg" className="w-full" asChild>
      <Link href={`/driver/navigate/${missionId}`}>
        <Navigation className="mr-1.5 h-4 w-4" />
        Naviguer
      </Link>
    </Button>
  );
}

function isMissionStarted(mission: DriverMission) {
  return mission.missionStartedAt != null;
}

interface MissionCardProps {
  mission: DriverMission;
  showActions?: boolean;
}

export function MissionCard({ mission, showActions = true }: MissionCardProps) {
  const updateStatus = useUpdateMissionStatus();
  const startMission = useStartMission();
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"PURCHASING" | "IN_DELIVERY" | null>(
    null
  );
  const [locationConfirm, setLocationConfirm] = useState<{
    kind: ProximityTargetKind;
    distanceMeters: number | null;
    pending: {
      status: "PURCHASING" | "DELIVERED";
      purchaseItems?: { id: string; unitPrice: number }[];
    };
  } | null>(null);
  const [locationChecking, setLocationChecking] = useState(false);

  const isCourier = mission.deliveryCategory === "COURIER";
  const courierPickups = getCourierPickupStops({
    deliveryCategory: mission.deliveryCategory,
    stops: mission.order.stops,
    pickupAddress: mission.pickupAddress,
    pickupCity: mission.pickupCity,
    pickupPostalCode: mission.pickupPostalCode,
    pickupInstructions: null,
  });
  const started = isMissionStarted(mission);
  const showNavigation = canNavigateMission(mission);

  const statusLabels = {
    PURCHASING: isCourier ? "Collecté" : "Achat en cours",
    IN_DELIVERY: "En livraison",
    DELIVERED: "Livraison terminée",
  } as const;

  const submitStatus = async (
    status: "PURCHASING" | "IN_DELIVERY" | "DELIVERED",
    purchaseItems?: { id: string; unitPrice: number }[],
    confirmOutOfRange = false
  ) => {
    const position = await getCurrentDriverPosition();

    try {
      await updateStatus.mutateAsync({
        id: mission.id,
        status,
        purchaseItems,
        confirmOutOfRange,
        latitude: position?.latitude,
        longitude: position?.longitude,
      });
      toast.success(statusLabels[status]);
      setPurchaseDialogOpen(false);
      setPendingStatus(null);
      setLocationConfirm(null);
    } catch (error) {
      if (error instanceof DriverApiError && error.code === "DRIVER_NOT_AT_LOCATION") {
        setLocationConfirm({
          kind: error.kind ?? (status === "DELIVERED" ? "delivery" : "pickup"),
          distanceMeters: error.distanceMeters ?? null,
          pending: {
            status: status === "IN_DELIVERY" ? "DELIVERED" : status,
            purchaseItems,
          },
        });
        return;
      }

      toast.error("Mise à jour impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleStartMission = async () => {
    try {
      await startMission.mutateAsync(mission.id);
      toast.success("Mission démarrée", {
        description: isCourier
          ? "L'itinéraire est visible sur la carte dispatch."
          : "Phase attente d'achat activée sur la carte dispatch.",
      });
    } catch (error) {
      toast.error("Impossible de démarrer la mission", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const requestStatusChange = (status: "PURCHASING" | "IN_DELIVERY") => {
    if (
      missionNeedsPurchaseValidation(mission) &&
      (status === "PURCHASING" || status === "IN_DELIVERY")
    ) {
      setPendingStatus(status);
      setPurchaseDialogOpen(true);
      return;
    }
    void submitStatus(status);
  };

  const runWithLocationGuard = async (
    kind: ProximityTargetKind,
    status: "PURCHASING" | "DELIVERED",
    purchaseItems?: { id: string; unitPrice: number }[]
  ) => {
    setLocationChecking(true);
    try {
      const result = await checkMissionLocationProximity(mission.id, kind);
      if (result.proceed) {
        await submitStatus(status, purchaseItems);
        return;
      }

      setLocationConfirm({
        kind: result.block.kind,
        distanceMeters: result.block.distanceMeters,
        pending: { status, purchaseItems },
      });
    } catch (error) {
      toast.error("Impossible de vérifier votre position", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLocationChecking(false);
    }
  };

  const confirmLocationAction = async () => {
    if (!locationConfirm) return;
    const { pending } = locationConfirm;
    await submitStatus(pending.status, pending.purchaseItems, true);
  };

  const actionLoading = updateStatus.isPending || locationChecking;

  const purchaseDialogCopy =
    pendingStatus === "PURCHASING"
      ? {
          title: "Saisir les prix d'achat",
          description:
            "Indiquez les prix réels des articles achetés. Ils serviront de base pour la facture client.",
          confirmLabel: "Valider les achats",
        }
      : {
          title: "Confirmer les achats",
          description:
            "Vérifiez ou modifiez les prix avant de partir en livraison. Ces montants seront utilisés pour la facturation.",
          confirmLabel: "Partir en livraison",
        };

  return (
    <>
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{mission.reference}</span>
            <DeliveryStatusBadge
              status={mission.status}
              deliveryCategory={mission.deliveryCategory}
            />
          </div>
          {showActions && (
            <MissionStepper status={mission.status} category={mission.deliveryCategory} />
          )}
          <div>
            <p className="font-medium">
              {formatClientFromParts(mission.order.customer, mission.order.customerEmail)}
            </p>
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              {mission.order.itemCount} colis
            </span>
            {mission.order.items.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {mission.order.items.map((i) => i.name).join(", ")}
              </Badge>
            )}
            {started && (
              <Badge variant="brand" className="text-xs">
                Mission en cours
              </Badge>
            )}
          </div>
          {showActions && (
            <div className="flex flex-col gap-2 pt-1">
              {mission.status === "ASSIGNED" && !started && (
                <Button
                  variant="brand"
                  size="lg"
                  className="w-full"
                  loading={startMission.isPending}
                  onClick={() => void handleStartMission()}
                >
                  <Play className="mr-1.5 h-4 w-4" />
                  Commencer la mission
                </Button>
              )}

              {mission.status === "ASSIGNED" && started && (
                <>
                  {showNavigation && <MissionNavigateButton missionId={mission.id} />}
                  {isCourier ? (
                    <Button
                      variant="brand"
                      size="lg"
                      className="w-full"
                      loading={actionLoading}
                      onClick={() => void runWithLocationGuard("pickup", "PURCHASING")}
                    >
                      <PackageCheck className="mr-1.5 h-4 w-4" />
                      Colis récupéré
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="brand"
                        size="lg"
                        className="w-full"
                        loading={updateStatus.isPending}
                        onClick={() => requestStatusChange("PURCHASING")}
                      >
                        <ShoppingCart className="mr-1.5 h-4 w-4" />
                        En cours d&apos;achat
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full"
                        loading={updateStatus.isPending}
                        onClick={() => requestStatusChange("IN_DELIVERY")}
                      >
                        <Truck className="mr-1.5 h-4 w-4" />
                        Passer en livraison
                      </Button>
                    </>
                  )}
                </>
              )}

              {mission.status === "PURCHASING" && (
                <>
                  {showNavigation && <MissionNavigateButton missionId={mission.id} />}
                  <Button
                    variant="brand"
                    size="lg"
                    className="w-full"
                    loading={updateStatus.isPending}
                    onClick={() => requestStatusChange("IN_DELIVERY")}
                  >
                    <Truck className="mr-1.5 h-4 w-4" />
                    Partir en livraison
                  </Button>
                </>
              )}

              {mission.status === "IN_DELIVERY" && (
                <>
                  {showNavigation && <MissionNavigateButton missionId={mission.id} />}
                  <Button
                    variant="brand"
                    size="lg"
                    className="w-full"
                    loading={actionLoading}
                    onClick={() => void runWithLocationGuard("delivery", "DELIVERED")}
                  >
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    Confirmer la livraison
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {pendingStatus && (
        <PurchaseValidationDialog
          open={purchaseDialogOpen}
          onOpenChange={(open) => {
            setPurchaseDialogOpen(open);
            if (!open) setPendingStatus(null);
          }}
          items={mission.order.items}
          title={purchaseDialogCopy.title}
          description={purchaseDialogCopy.description}
          confirmLabel={purchaseDialogCopy.confirmLabel}
          loading={updateStatus.isPending}
          onConfirm={(purchaseItems) => submitStatus(pendingStatus, purchaseItems)}
        />
      )}
      {locationConfirm && (
        <LocationConfirmationDialog
          open={Boolean(locationConfirm)}
          onOpenChange={(open) => {
            if (!open) setLocationConfirm(null);
          }}
          kind={locationConfirm.kind}
          distanceMeters={locationConfirm.distanceMeters}
          loading={updateStatus.isPending}
          onConfirm={() => void confirmLocationAction()}
        />
      )}
    </>
  );
}
