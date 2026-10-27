"use client";

import { useEffect, useState } from "react";
import type { OrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getAdminEditableOrderStatuses,
  getCompactStatusLabel,
  getFulfillmentStatusLabel,
} from "@/lib/constants/order-status";
import type { DeliveryCategory } from "@prisma/client";
import type { UpdateOrderStatusInput } from "@/lib/validations/order";
import { useUpdateOrderStatus } from "./hooks";
import { TABLE_SELECT_TRIGGER_CLASS } from "./table-ui";
import { toast } from "sonner";

interface OrderStatusSelectProps {
  orderId: string;
  currentStatus: OrderStatus;
  deliveryCategory?: DeliveryCategory | null;
  compact?: boolean;
}

export function OrderStatusSelect({
  orderId,
  currentStatus,
  deliveryCategory,
  compact,
}: OrderStatusSelectProps) {
  const updateStatus = useUpdateOrderStatus();
  const [status, setStatus] = useState<UpdateOrderStatusInput["status"]>(currentStatus);
  const hasChange = status !== currentStatus;
  const editableStatuses = getAdminEditableOrderStatuses(currentStatus, deliveryCategory);
  const isSpecialQuote =
    currentStatus === "QUOTE_REQUESTED" && deliveryCategory === "SPECIAL_MISSION";

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  const handleSave = async () => {
    try {
      await updateStatus.mutateAsync({ orderId, data: { status } });
      toast.success("Statut mis à jour");
    } catch (error) {
      toast.error("Mise à jour impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  if (compact) {
    return (
      <Select
        value={status}
        onValueChange={(v) => {
          const next = v as UpdateOrderStatusInput["status"];
          setStatus(next);
          if (next !== currentStatus) {
            updateStatus.mutate(
              { orderId, data: { status: next } },
              {
                onSuccess: () => toast.success("Statut mis à jour"),
                onError: (error) =>
                  toast.error("Mise à jour impossible", {
                    description: error instanceof Error ? error.message : undefined,
                  }),
              }
            );
          }
        }}
        disabled={updateStatus.isPending}
      >
        <SelectTrigger aria-label="Modifier le statut de la commande" className={TABLE_SELECT_TRIGGER_CLASS}>
          <SelectValue>{getCompactStatusLabel(status, deliveryCategory)}</SelectValue>
        </SelectTrigger>
        <SelectContent align="start" className="max-h-48 min-w-[8.5rem]">
          {editableStatuses.map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              {getCompactStatusLabel(s, deliveryCategory)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Statut actuel :{" "}
        <span className="font-medium text-foreground">
          {getFulfillmentStatusLabel(currentStatus, deliveryCategory)}
        </span>
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1 max-md:min-w-0 max-md:w-full">
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as UpdateOrderStatusInput["status"])}
          >
            <SelectTrigger aria-label="Nouveau statut de la commande">
              {/* Libellé explicite : le statut actuel n'est pas toujours dans la liste modifiable. */}
              <SelectValue>{getFulfillmentStatusLabel(status, deliveryCategory)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {editableStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {getFulfillmentStatusLabel(s, deliveryCategory)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="brand"
          disabled={!hasChange || updateStatus.isPending}
          loading={updateStatus.isPending}
          onClick={handleSave}
        >
          Mettre à jour
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {isSpecialQuote
          ? "Passez à « En attente » uniquement après un accord obtenu hors TutelLiv. L’acceptation du devis n’est pas enregistrée dans la plateforme."
          : "L’administrateur peut modifier le statut à tout moment, y compris annuler la livraison."}
      </p>
    </div>
  );
}
