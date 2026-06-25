"use client";

import { useEffect, useState } from "react";
import type { DeliveryStatus } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { ADMIN_EDITABLE_STATUSES, getFulfillmentStatusLabel } from "@/lib/constants/order-status";
import type { DeliveryCategory } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import { useUpdateDelivery } from "./hooks";
import { toast } from "sonner";

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
    address?: string;
    city?: string | null;
    postalCode?: string | null;
    pickupAddress?: string | null;
    pickupCity?: string | null;
    pickupPostalCode?: string | null;
    scheduledAt?: string | null;
    estimatedArrival?: string | null;
    trackingEvents?: TrackingEvent[];
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
          reason: reason || undefined,
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
    if (!confirm("Annuler cette livraison ? Cette action est visible par le client.")) return;
    try {
      await update.mutateAsync({
        deliveryId: delivery.id,
        data: {
          status: "CANCELLED",
          reason: reason || "Annulée par l'administrateur",
        },
      });
      setReason("");
      toast.success("Livraison annulée");
    } catch (error) {
      toast.error("Annulation impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  if (delivery.status === "CANCELLED") {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Livraison annulée</CardTitle>
        </CardHeader>
        <CardContent>
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
        <CardTitle className="text-base">Gestion livraison — {delivery.reference}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Statut">
            <Select value={status} onValueChange={(v) => setStatus(v as DeliveryStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADMIN_EDITABLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {getFulfillmentStatusLabel(s, deliveryCategory)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Date prévue">
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </FormField>
          <FormField label="Adresse">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </FormField>
          <FormField label="Ville">
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </FormField>
          <FormField label="Code postal">
            <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          </FormField>
          <FormField label="Motif (optionnel)">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Raison de la modification..."
            />
          </FormField>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="brand" loading={update.isPending} onClick={() => handleUpdate()}>
            Enregistrer les modifications
          </Button>
          <Button
            variant="destructive"
            loading={update.isPending}
            onClick={handleCancel}
          >
            Annuler la livraison
          </Button>
        </div>

        {delivery.trackingEvents && delivery.trackingEvents.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-medium">Historique / activité</h4>
            <TrackingTimeline events={delivery.trackingEvents} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrackingTimeline({ events }: { events: TrackingEvent[] }) {
  return (
    <ol className="space-y-3 border-l border-border pl-4">
      {[...events].reverse().map((event) => (
        <li key={event.id} className="relative text-sm">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
          <p className="font-medium">{event.label}</p>
          {event.description && (
            <p className="text-muted-foreground">{event.description}</p>
          )}
          <p className="text-xs text-muted-foreground">{formatDate(event.occurredAt)}</p>
        </li>
      ))}
    </ol>
  );
}
