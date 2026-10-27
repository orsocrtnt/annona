"use client";

import { useMemo, useState } from "react";
import type { DeliveryCategory, DeliveryStatus } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isSoftIneligibilityMessage } from "@/lib/dispatch/driver-eligibility";
import { formatDriverFromParts, withoutRolePrefix } from "@/lib/format/person-labels";
import { useAssignDelivery, useUnassignDelivery } from "./hooks";
import { TABLE_SELECT_TRIGGER_CLASS } from "./table-ui";
import {
  getDeliveryEligibilityInput,
  useDispatchDriverOptions,
  type DispatchDriverOption,
} from "./use-dispatch-driver-options";

interface AssignDriverSelectProps {
  deliveryId: string;
  status: DeliveryStatus;
  driverId?: string | null;
  driverName?: string | null;
  driver?: { firstName: string; lastName: string } | null;
  missionStartedAt?: string | Date | null;
  deliveryCategory?: DeliveryCategory;
  postalCode?: string | null;
  pickupPostalCode?: string | null;
  compact?: boolean;
}

type PendingAssign = {
  driverId: string;
  driverLabel: string;
  reasons: string;
};

function getDriverLabel(
  driverName?: string | null,
  driver?: { firstName: string; lastName: string } | null
) {
  const label = formatDriverFromParts(driver, driverName, { unassignedLabel: "" });
  return label === "Non assigné" ? null : label;
}

function DriverSelectItems({
  compatible,
  overCapacity,
  incompatible,
  showAll,
}: {
  compatible: DispatchDriverOption[];
  overCapacity: DispatchDriverOption[];
  incompatible: DispatchDriverOption[];
  showAll: boolean;
}) {
  if (compatible.length === 0 && overCapacity.length === 0 && incompatible.length === 0) {
    return (
      <SelectItem value="_none" disabled>
        Aucun chauffeur
      </SelectItem>
    );
  }

  return (
    <>
      {compatible.map((item) => (
        <SelectItem key={item.driver.id} value={item.driver.id} className="text-xs">
          {formatDriverFromParts(item.driver, null)}
        </SelectItem>
      ))}
      {overCapacity.map((item) => (
        <SelectItem key={item.driver.id} value={item.driver.id} className="text-xs text-amber-700">
          {formatDriverFromParts(item.driver, null)} — {item.reasons}
        </SelectItem>
      ))}
      {showAll &&
        incompatible.map((item) => (
          <SelectItem
            key={item.driver.id}
            value={item.driver.id}
            className="text-xs text-muted-foreground"
            disabled
          >
            {formatDriverFromParts(item.driver, null)} — {item.reasons}
          </SelectItem>
        ))}
    </>
  );
}

export function AssignDriverSelect({
  deliveryId,
  status,
  driverId,
  driverName,
  driver,
  missionStartedAt,
  deliveryCategory,
  postalCode,
  pickupPostalCode,
  compact,
}: AssignDriverSelectProps) {
  const assign = useAssignDelivery();
  const unassign = useUnassignDelivery();
  const [driverIdDraft, setDriverIdDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [showAllDrivers, setShowAllDrivers] = useState(false);
  const [pendingAssign, setPendingAssign] = useState<PendingAssign | null>(null);

  const eligibilityInput = useMemo(
    () =>
      getDeliveryEligibilityInput({
        deliveryCategory,
        postalCode,
        pickupPostalCode,
      }),
    [deliveryCategory, postalCode, pickupPostalCode]
  );

  const { compatible, overCapacity, incompatible } = useDispatchDriverOptions(eligibilityInput);

  const overCapacityIds = useMemo(
    () => new Set(overCapacity.map((item) => item.driver.id)),
    [overCapacity]
  );
  const incompatibleIds = useMemo(
    () => new Set(incompatible.map((item) => item.driver.id)),
    [incompatible]
  );

  const assignedLabel = getDriverLabel(driverName, driver);
  const canManage =
    !missionStartedAt && (status === "PENDING" || status === "ASSIGNED");
  const isMissionInProgress =
    Boolean(missionStartedAt) || status === "PURCHASING" || status === "IN_DELIVERY";
  const isReassign = Boolean(assignedLabel);

  const findDriverOption = (id: string) =>
    [...compatible, ...overCapacity, ...incompatible].find((item) => item.driver.id === id);

  const handleAssign = async (id: string, force = false) => {
    if (!id || !canManage) return;
    try {
      await assign.mutateAsync({ deliveryId, driverId: id, force });
      setDriverIdDraft("");
      setEditing(false);
      setPendingAssign(null);
      toast.success(
        force
          ? isReassign
            ? "Chauffeur réassigné (charge dépassée)"
            : "Chauffeur assigné (charge dépassée)"
          : isReassign
            ? "Chauffeur réassigné"
            : "Chauffeur assigné"
      );
    } catch (error) {
      if (error instanceof Error && !force && isSoftIneligibilityMessage(error.message)) {
        const option = findDriverOption(id);
        setPendingAssign({
          driverId: id,
          driverLabel: formatDriverFromParts(option?.driver ?? null, null),
          reasons: error.message,
        });
        return;
      }

      toast.error(isReassign ? "Réassignation impossible" : "Assignation impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const requestAssign = (id: string) => {
    if (overCapacityIds.has(id)) {
      const item = overCapacity.find((entry) => entry.driver.id === id);
      setPendingAssign({
        driverId: id,
        driverLabel: formatDriverFromParts(item?.driver ?? null, null),
        reasons: item?.reasons ?? "Charge max atteinte",
      });
      return;
    }

    if (incompatibleIds.has(id)) {
      const item = incompatible.find((entry) => entry.driver.id === id);
      toast.error("Chauffeur incompatible avec cette livraison", {
        description: item?.reasons ?? "Règles dispatch non respectées",
      });
      return;
    }

    void handleAssign(id);
  };

  const confirmPendingAssign = () => {
    if (!pendingAssign) return;
    void handleAssign(pendingAssign.driverId, true);
  };

  const selectableCount = compatible.length + overCapacity.length;

  if (!canManage) {
    if (compact) {
      return (
        <span
          className="text-xs text-muted-foreground"
          title={isMissionInProgress ? "Affectation verrouillée : mission démarrée" : "Affectation verrouillée"}
        >
          {assignedLabel ?? "—"}
        </span>
      );
    }

    return (
      <span className="text-sm text-muted-foreground">
        {assignedLabel ?? "—"} ({isMissionInProgress ? "mission démarrée" : "affectation verrouillée"})
      </span>
    );
  }

  if (compact) {
    const showIncompatible = showAllDrivers || selectableCount === 0;

    return (
      <>
        <div className="space-y-1">
          <Select
            value={driverId || undefined}
            onValueChange={requestAssign}
            disabled={assign.isPending}
          >
            <SelectTrigger aria-label="Assigner un chauffeur" className={TABLE_SELECT_TRIGGER_CLASS}>
              {/* Le livreur affecté n'est pas toujours dans la liste filtrée : on affiche quand même son nom. */}
              <SelectValue placeholder={selectableCount > 0 ? "Chauffeur" : "Aucun compatible"}>
                {driverId && assignedLabel ? withoutRolePrefix(assignedLabel) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start" className="max-h-48 min-w-[8.5rem]">
              <DriverSelectItems
                compatible={compatible}
                overCapacity={overCapacity}
                incompatible={incompatible}
                showAll={showIncompatible}
              />
            </SelectContent>
          </Select>
          {incompatible.length > 0 && selectableCount > 0 && (
            <button
              type="button"
              className="text-[10px] text-muted-foreground underline"
              onClick={() => setShowAllDrivers((value) => !value)}
            >
              {showAllDrivers ? "Masquer hors règles" : "Voir hors règles"}
            </button>
          )}
        </div>

        <AssignConfirmDialog
          pending={pendingAssign}
          isReassign={isReassign}
          loading={assign.isPending}
          onConfirm={confirmPendingAssign}
          onCancel={() => setPendingAssign(null)}
        />
      </>
    );
  }

  if (!editing && assignedLabel) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">{assignedLabel}</span>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>
            Changer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive"
            disabled={unassign.isPending}
            onClick={async () => {
              try {
                await unassign.mutateAsync(deliveryId);
                toast.success("Chauffeur retiré");
              } catch (error) {
                toast.error("Action impossible", {
                  description: error instanceof Error ? error.message : undefined,
                });
              }
            }}
          >
            Retirer
          </Button>
        </div>

        <AssignConfirmDialog
          pending={pendingAssign}
          isReassign={isReassign}
          loading={assign.isPending}
          onConfirm={confirmPendingAssign}
          onCancel={() => setPendingAssign(null)}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {assignedLabel && editing && (
          <p className="text-sm text-muted-foreground">
            Actuellement : <span className="font-medium text-foreground">{assignedLabel}</span>
          </p>
        )}
        {selectableCount === 0 && (
          <p className="text-sm text-amber-700">
            Aucun chauffeur compatible. Les chauffeurs hors règles sont affichés à titre informatif
            et ne peuvent pas être assignés.
          </p>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1 max-md:min-w-0 max-md:w-full">
            <Select
              value={driverIdDraft}
              onValueChange={setDriverIdDraft}
              disabled={assign.isPending}
            >
              <SelectTrigger aria-label="Choisir un chauffeur">
                <SelectValue placeholder="Choisir un chauffeur..." />
              </SelectTrigger>
              <SelectContent>
                <DriverSelectItems
                  compatible={compatible}
                  overCapacity={overCapacity}
                  incompatible={incompatible}
                  showAll={showAllDrivers || selectableCount === 0}
                />
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="brand"
            disabled={!driverIdDraft || assign.isPending}
            loading={assign.isPending}
            onClick={() => requestAssign(driverIdDraft)}
          >
            {assignedLabel ? "Réassigner" : "Assigner au chauffeur"}
          </Button>
          {incompatible.length > 0 && selectableCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowAllDrivers((value) => !value)}>
              {showAllDrivers ? "Masquer hors règles" : "Voir hors règles"}
            </Button>
          )}
          {editing && (
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          )}
        </div>
      </div>

      <AssignConfirmDialog
        pending={pendingAssign}
        isReassign={isReassign}
        loading={assign.isPending}
        onConfirm={confirmPendingAssign}
        onCancel={() => setPendingAssign(null)}
      />
    </>
  );
}

function AssignConfirmDialog({
  pending,
  isReassign,
  loading,
  onConfirm,
  onCancel,
}: {
  pending: PendingAssign | null;
  isReassign: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isReassign ? "Réassigner malgré la charge max ?" : "Assigner malgré la charge max ?"}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 pt-1 text-sm text-muted-foreground">
              {pending && (
                <>
                  <p>
                    <span className="font-medium text-foreground">{pending.driverLabel}</span> a
                    atteint sa limite de livraisons actives.
                  </p>
                  <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-900">
                    {pending.reasons}
                  </p>
                  <p>Confirmez-vous {isReassign ? "cette réassignation" : "cette assignation"} ?</p>
                </>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Annuler
          </Button>
          <Button variant="brand" onClick={onConfirm} loading={loading}>
            {isReassign ? "Confirmer la réassignation" : "Confirmer l'assignation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
