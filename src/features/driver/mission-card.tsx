"use client";
import { OrderTrackingTrigger } from "@/components/shared/order-tracking";
import { OrderConversationTrigger } from "@/components/shared/order-conversation";

import { useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeliveryStatusBadge } from "@/features/client-portal/status-badges";
import { useStartMission, useUpdateMissionStatus, useAcknowledgeMission } from "./hooks";
import type { DriverMission } from "./types";
import {
  PurchaseValidationDialog,
  missionNeedsPurchaseValidation,
} from "./purchase-validation-dialog";
import { LocationConfirmationDialog } from "./location-confirmation-dialog";
import { ProofOfDeliveryDialog, type PodDialogValue } from "./proof-of-delivery-dialog";
import { ProofOfDeliveryCard } from "@/features/deliveries/proof-of-delivery-card";
import { checkMissionLocationProximity } from "./mission-location-guard";
import { DriverApiError } from "./api";
import { type DriverPosition, type ProximityTargetKind } from "@/lib/maps/driver-proximity";
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
import { formatClientFromParts, withoutRolePrefix } from "@/lib/format/person-labels";
import { toast } from "sonner";
import { MissionAcknowledgement } from "@/components/shared/mission-acknowledgement";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useQueuedDriverAction } from "./driver-action-queue-provider";


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
  const acknowledgement = useAcknowledgeMission();
  const queuedAction = useQueuedDriverAction(mission.id);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const acknowledge = async (action: "accept" | "decline") => {
    try {
      await acknowledgement.mutateAsync({ id: mission.id, action, expectedUpdatedAt: mission.updatedAt, reason: action === "decline" ? declineReason : undefined });
      setDeclineOpen(false);
      toast.success(action === "accept" ? "Prise en charge confirmée" : "Mission rendue au dispatch");
    } catch (error) {
      toast.error("Action impossible", { description: error instanceof Error ? error.message : undefined });
    }
  };
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"PURCHASING" | "IN_DELIVERY" | null>(
    null
  );
  const [locationConfirm, setLocationConfirm] = useState<{
    kind: ProximityTargetKind;
    distanceMeters: number | null;
    position: DriverPosition | null;
    pending: {
      status: "PURCHASING" | "DELIVERED" | "FAILED";
      purchaseItems?: { id: string; unitPrice: number }[];
      pod?: PodDialogValue;
    };
  } | null>(null);
  const [locationChecking, setLocationChecking] = useState(false);
  const actionInFlight = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [podDialog, setPodDialog] = useState<"SUCCESS" | "FAILED" | null>(null);

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
    FAILED: "Échec enregistré",
  } as const;

  const submitStatus = async (
    status: "PURCHASING" | "IN_DELIVERY" | "DELIVERED" | "FAILED",
    purchaseItems?: { id: string; unitPrice: number }[],
    confirmOutOfRange = false,
    pod?: PodDialogValue,
    position: DriverPosition | null = null
  ) => {
    setActionError(null);
    setActionMessage("Enregistrement en cours…");

    try {
      const submission = await updateStatus.mutateAsync({
        id: mission.id,
        status,
        purchaseItems,
        confirmOutOfRange,
        latitude: position?.latitude,
        longitude: position?.longitude,
        pod,
      });
      if (submission.disposition === "queued") {
        toast.warning("Action conservée hors ligne", {
          description: "Elle sera renvoyée automatiquement dès que la connexion sera disponible.",
        });
      } else {
        toast.success(statusLabels[status]);
      }
      setPurchaseDialogOpen(false);
      setPendingStatus(null);
      setLocationConfirm(null);
      setPodDialog(null);
    } catch (error) {
      if (error instanceof DriverApiError && error.code === "DRIVER_NOT_AT_LOCATION") {
        setLocationConfirm({
          kind: error.kind ?? "delivery",
          distanceMeters: error.distanceMeters ?? null,
          position,
          pending: {
            status: status === "IN_DELIVERY" ? "DELIVERED" : status,
            purchaseItems,
            pod,
          },
        });
        return;
      }

      setActionError(error instanceof Error ? error.message : "Mise à jour impossible. Réessayez.");
      toast.error("Mise à jour impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setActionMessage(null);
    }
  };

  const handleStartMission = async () => {
    try {
      await startMission.mutateAsync({ id: mission.id, expectedUpdatedAt: mission.updatedAt });
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
    status: "PURCHASING" | "DELIVERED" | "FAILED",
    purchaseItems?: { id: string; unitPrice: number }[],
    pod?: PodDialogValue
  ) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setLocationChecking(true);
    setActionError(null);
    setActionMessage("Vérification de votre position… Cela peut prendre jusqu’à 14 secondes.");
    try {
      const result = await checkMissionLocationProximity(mission.id, kind);
      if (result.proceed) {
        await submitStatus(status, purchaseItems, false, pod, result.position);
        return;
      }

      setLocationConfirm({
        kind: result.block.kind,
        distanceMeters: result.block.distanceMeters,
        position: result.position,
        pending: { status, purchaseItems, pod },
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Impossible de vérifier votre position. Réessayez.");
      toast.error("Impossible de vérifier votre position", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      actionInFlight.current = false;
      setLocationChecking(false);
      setActionMessage(null);
    }
  };

  const confirmLocationAction = async () => {
    if (!locationConfirm || actionInFlight.current) return;
    actionInFlight.current = true;
    setLocationChecking(true);
    const { pending, position } = locationConfirm;
    try {
      await submitStatus(pending.status, pending.purchaseItems, true, pending.pod, position);
    } finally {
      actionInFlight.current = false;
      setLocationChecking(false);
    }
  };

  const actionLoading = updateStatus.isPending || locationChecking || actionMessage !== null;
  const actionDisabled = actionLoading || queuedAction !== null;

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
          {/* Qui livrer d'abord ; la référence reste en petit (support, recherche). L'app ne montre
              que les missions du livreur connecté : pas de ligne « Responsable : vous ». */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">
                {withoutRolePrefix(formatClientFromParts(mission.order.customer, mission.order.customerEmail))}
              </p>
              <span className="text-xs tabular-nums text-muted-foreground">{mission.reference}</span>
            </div>
            <DeliveryStatusBadge
              status={mission.status}
              deliveryCategory={mission.deliveryCategory}
            />
          </div>
          <MissionAcknowledgement {...mission} compact />
          <div className="flex flex-wrap gap-2">
            <OrderTrackingTrigger orderId={mission.orderId} />
            <OrderConversationTrigger orderId={mission.orderId} />
          </div>
          {showActions && (
            <MissionStepper status={mission.status} category={mission.deliveryCategory} />
          )}
          <div>
            <div className="mt-1">
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
          {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
          {actionMessage && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{actionMessage}</p>}
          {queuedAction && (
            <p role={queuedAction.state === "failed" ? "alert" : "status"} aria-live="polite" className="rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-sm">
              {queuedAction.state === "failed"
                ? queuedAction.lastError ?? "Action enregistrée, mais refusée par le serveur."
                : "Action enregistrée sur cet appareil, en attente de synchronisation."}
            </p>
          )}
          {showActions && (
            <div className="flex flex-col gap-2 pt-1">
              {mission.status === "ASSIGNED" && !started && !mission.missionAcceptedAt && (
                <Button variant="brand" size="lg" className="w-full" loading={acknowledgement.isPending} onClick={() => void acknowledge("accept")}>
                  Prendre en charge
                </Button>
              )}
              {mission.status === "ASSIGNED" && !started && (
                <Button variant="outline" disabled={acknowledgement.isPending || startMission.isPending} onClick={() => setDeclineOpen(true)}>Refuser / indisponible</Button>
              )}
              {mission.status === "ASSIGNED" && !started && mission.missionAcceptedAt && (
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
                      disabled={actionDisabled}
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
                        loading={actionLoading}
                        disabled={actionDisabled}
                        onClick={() => requestStatusChange("PURCHASING")}
                      >
                        <ShoppingCart className="mr-1.5 h-4 w-4" />
                        En cours d&apos;achat
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full"
                        loading={actionLoading}
                        disabled={actionDisabled}
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
                    loading={actionLoading}
                    disabled={actionDisabled}
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
                    disabled={actionDisabled}
                    onClick={() => setPodDialog("SUCCESS")}
                  >
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    Confirmer la livraison
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    disabled={actionDisabled}
                    onClick={() => setPodDialog("FAILED")}
                  >
                    Échec de livraison
                  </Button>
                </>
              )}
            </div>
          )}
          {(mission.status === "DELIVERED" || mission.status === "FAILED") && (
            <ProofOfDeliveryCard
              status={mission.status}
              photoUrl={mission.podPhotoUrl}
              failureCode={mission.podFailureCode}
              note={mission.podNote}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rendre la mission au dispatch</DialogTitle><DialogDescription>Indiquez pourquoi vous ne pouvez pas effectuer cette mission. Le motif sera conservé dans son historique partagé.</DialogDescription></DialogHeader>
          <label htmlFor={`decline-${mission.id}`}>Motif de refus</label>
          <textarea className="min-h-24 w-full rounded-md border p-2" id={`decline-${mission.id}`} value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} maxLength={500} />
          <DialogFooter><Button variant="outline" onClick={() => setDeclineOpen(false)}>Annuler</Button><Button disabled={!declineReason.trim()} loading={acknowledgement.isPending} onClick={() => void acknowledge("decline")}>Confirmer le refus</Button></DialogFooter>
        </DialogContent>
      </Dialog>
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
          loading={actionLoading}
          feedbackMessage={actionMessage ?? actionError}
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
          loading={actionLoading}
          feedbackMessage={actionMessage ?? actionError}
          onConfirm={() => void confirmLocationAction()}
        />
      )}
      {podDialog && (
        <ProofOfDeliveryDialog
          open={Boolean(podDialog)}
          outcome={podDialog}
          loading={actionLoading}
          feedbackMessage={actionMessage ?? actionError}
          onOpenChange={(open) => {
            if (!open) setPodDialog(null);
          }}
          onConfirm={(value) => {
            void runWithLocationGuard(
              "delivery",
              value.outcome === "FAILED" ? "FAILED" : "DELIVERED",
              undefined,
              value
            );
          }}
        />
      )}
    </>
  );
}
