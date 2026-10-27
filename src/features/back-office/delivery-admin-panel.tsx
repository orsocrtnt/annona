"use client";

import { isPlannedTrackingEvent } from "@/domains/tracking/tracking.policy";
import { MissionAcknowledgement } from "@/components/shared/mission-acknowledgement";
import { useEffect, useState } from "react";
import type { DeliveryCategory, DeliveryStatus } from "@prisma/client";
import { toast } from "sonner";
import { ProofOfDeliveryCard } from "@/features/deliveries/proof-of-delivery-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ADMIN_EDITABLE_STATUSES, getFulfillmentStatusLabel } from "@/lib/constants/order-status";
import { formatDate } from "@/lib/utils";
import { useUpdateDelivery } from "./hooks";

interface TrackingEvent {
  id: string;
  label: string;
  description?: string | null;
  occurredAt: string;
}

interface DeliveryAdminPanelProps {
  delivery: {
    id: string;
    reference: string;
    status: DeliveryStatus;
    missionStartedAt?: string | null;
    missionAcceptedAt?: string | null;
    address?: string;
    city?: string | null;
    postalCode?: string | null;
    pickupAddress?: string | null;
    pickupCity?: string | null;
    pickupPostalCode?: string | null;
    scheduledAt?: string | null;
    estimatedArrival?: string | null;
    trackingEvents?: TrackingEvent[];
    podPhotoUrl?: string | null;
    podFailureCode?: string | null;
    podNote?: string | null;
  };
  deliveryCategory?: DeliveryCategory | null;
}

export function DeliveryAdminPanel({ delivery, deliveryCategory }: DeliveryAdminPanelProps) {
  const update = useUpdateDelivery();
  const [status, setStatus] = useState<DeliveryStatus>(delivery.status);
  const [address, setAddress] = useState(delivery.address ?? "");
  const [city, setCity] = useState(delivery.city ?? "");
  const [postalCode, setPostalCode] = useState(delivery.postalCode ?? "");
  const [scheduledAt, setScheduledAt] = useState(
    delivery.scheduledAt ? delivery.scheduledAt.slice(0, 16) : ""
  );
  const [reason, setReason] = useState("");
  const isMissionInProgress =
    Boolean(delivery.missionStartedAt) ||
    delivery.status === "PURCHASING" ||
    delivery.status === "IN_DELIVERY";

  useEffect(() => {
    setStatus(delivery.status);
    setAddress(delivery.address ?? "");
    setCity(delivery.city ?? "");
    setPostalCode(delivery.postalCode ?? "");
    setScheduledAt(delivery.scheduledAt ? delivery.scheduledAt.slice(0, 16) : "");
  }, [delivery]);

  const handleUpdate = async (extra?: { status?: DeliveryStatus; unassignDriver?: boolean }) => {
    try {
      await update.mutateAsync({
        deliveryId: delivery.id,
        data: {
          status: extra?.status ?? (status !== delivery.status ? status : undefined),
          address: address !== (delivery.address ?? "") ? address : undefined,
          city: city !== (delivery.city ?? "") ? city : undefined,
          postalCode: postalCode !== (delivery.postalCode ?? "") ? postalCode : undefined,
          scheduledAt: scheduledAt
            ? new Date(scheduledAt).toISOString()
            : delivery.scheduledAt
              ? null
              : undefined,
          unassignDriver: extra?.unassignDriver,
          reason: reason.trim() || undefined,
        },
      });
      setReason("");
      toast.success("Livraison mise à jour");
    } catch (error) {
      toast.error("Mise à jour impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleCancel = async () => {
    const cancellationReason = reason.trim();
    if (isMissionInProgress && !cancellationReason) {
      toast.error("Motif obligatoire", {
        description: "Indiquez pourquoi la mission déjà démarrée doit être annulée.",
      });
      return;
    }
    if (!confirm("Annuler cette livraison ? Cette action est visible par le client.")) return;
    try {
      await update.mutateAsync({
        deliveryId: delivery.id,
        data: {
          status: "CANCELLED",
          reason: cancellationReason || "Annulée par l'administrateur",
        },
      });
      setReason("");
      toast.success(isMissionInProgress ? "Mission annulée" : "Livraison annulée");
    } catch (error) {
      toast.error("Annulation impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  if (delivery.status === "CANCELLED" || delivery.status === "FAILED") {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            {delivery.status === "FAILED" ? "Livraison en échec" : "Livraison annulée"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProofOfDeliveryCard
            status={delivery.status}
            photoUrl={delivery.podPhotoUrl}
            failureCode={delivery.podFailureCode}
            note={delivery.podNote}
          />
          {delivery.trackingEvents && delivery.trackingEvents.length > 0 && (
            <TrackingTimeline events={delivery.trackingEvents} />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gérer la livraison</CardTitle>
        <p className="text-xs tabular-nums text-muted-foreground">{delivery.reference}</p>
      </CardHeader>
      <CardContent className="space-y-6">
            <MissionAcknowledgement {...delivery} />
        {isMissionInProgress && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900">
            La mission a démarré. Son annulation reste possible, mais un motif est obligatoire et sera
            conservé dans l’historique.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Statut">
            <Select value={status} onValueChange={(v) => setStatus(v as DeliveryStatus)}>
              <SelectTrigger aria-label="Statut de la livraison">
                {/* « Assigné » est exclu de la liste : on affiche quand même le statut courant. */}
                <SelectValue>{getFulfillmentStatusLabel(status, deliveryCategory)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ADMIN_EDITABLE_STATUSES.filter(
                  (candidate) => candidate !== "ASSIGNED" && candidate !== "CANCELLED"
                ).map((candidate) => (
                  <SelectItem key={candidate} value={candidate}>
                    {getFulfillmentStatusLabel(candidate, deliveryCategory)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Date prévue">
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
          </FormField>
          <FormField label="Adresse">
            <Input value={address} onChange={(event) => setAddress(event.target.value)} />
          </FormField>
          <FormField label="Ville">
            <Input value={city} onChange={(event) => setCity(event.target.value)} />
          </FormField>
          <FormField label="Code postal">
            <Input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
          </FormField>
          <FormField
            label="Motif"
            required={isMissionInProgress}
            hint={
              isMissionInProgress
                ? "Obligatoire pour annuler une mission démarrée."
                : "Optionnel pour une simple modification ou une annulation avant départ."
            }
          >
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={
                isMissionInProgress
                  ? "Pourquoi annuler cette mission ?"
                  : "Raison de la modification..."
              }
            />
          </FormField>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="brand" loading={update.isPending} onClick={() => handleUpdate()}>
            Enregistrer les modifications
          </Button>
          <Button variant="destructive" loading={update.isPending} onClick={handleCancel}>
            {isMissionInProgress ? "Annuler la mission" : "Annuler la livraison"}
          </Button>
        </div>

        {delivery.trackingEvents && delivery.trackingEvents.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-medium">Historique / activité</h4>
            <TrackingTimeline events={delivery.trackingEvents} />
          </div>
        )}

        {(delivery.status === "DELIVERED" || delivery.podPhotoUrl) && (
          <ProofOfDeliveryCard
            status={delivery.status}
            photoUrl={delivery.podPhotoUrl}
            failureCode={delivery.podFailureCode}
            note={delivery.podNote}
          />
        )}
      </CardContent>
    </Card>
  );
}

function TrackingTimeline({ events }: { events: TrackingEvent[] }) {
  return (
    <ol className="space-y-3 border-l border-border pl-4">
      {[...events].filter(event => !isPlannedTrackingEvent(event)).reverse().map((event) => (
        <li key={event.id} className="relative text-sm">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
          <p className="font-medium">{event.label}</p>
          {event.description && <p className="text-muted-foreground">{event.description}</p>}
          <p className="text-xs text-muted-foreground">{formatDate(event.occurredAt)}</p>
        </li>
      ))}
    </ol>
  );
}
