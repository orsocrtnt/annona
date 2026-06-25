"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { DispatchMapDelivery } from "@/domains/delivery/dispatch-map.service";
import { isPurchasingPhase } from "@/features/back-office/dispatch-delivery-map-state";
import { mapGlassCardStyle } from "@/components/maps/map-glass-styles";
import { cn } from "@/lib/utils";
import { ChevronDown, History, Package, ShoppingBag, Truck } from "lucide-react";
import { ReorderOrderButton } from "@/features/client-portal/reorder-order-button";
import type { DeliveryCategory } from "@prisma/client";

type MapTab = "active" | "history";

interface PortalDeliveriesMapPanelProps {
  activeDeliveries: DispatchMapDelivery[];
  historyDeliveries: DispatchMapDelivery[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function deliveryBadgeClasses(category: DeliveryCategory) {
  return category === "COURIER"
    ? "border-transparent bg-blue-200/80 text-blue-900"
    : "border-transparent bg-rose-200/80 text-rose-900";
}

function formatHistoryDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DeliveryListItem({
  delivery,
  isSelected,
  isHistorical,
  onSelect,
}: {
  delivery: DispatchMapDelivery;
  isSelected: boolean;
  isHistorical: boolean;
  onSelect: () => void;
}) {
  const purchasing = !isHistorical && isPurchasingPhase(delivery);
  const historyDate = formatHistoryDate(delivery.completedAt ?? delivery.createdAt);

  return (
    <div
      className={cn(
        "w-full rounded-xl border p-3 transition-colors",
        isSelected
          ? "border-brand/40 bg-white/95 shadow-sm"
          : "border-white/70 bg-white/70 hover:bg-white/90"
      )}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{delivery.reference}</span>
          <Badge className={deliveryBadgeClasses(delivery.deliveryCategory)}>
            {delivery.deliveryCategory === "COURIER" ? "Course" : "Commande"}
          </Badge>
        </div>

        {delivery.pickups.length > 0 ? (
          <div className="mt-2 space-y-1 text-sm">
            {delivery.pickups.map((pickup) => (
              <p key={pickup.id} className="line-clamp-2 text-muted-foreground">
                <span className="font-medium text-foreground">{pickup.label} :</span>{" "}
                {pickup.address}
              </p>
            ))}
            <p className="line-clamp-2 pt-1">
              <span className="font-medium">Livraison :</span> {delivery.address}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-2 line-clamp-2 text-sm">{delivery.address}</p>
            {delivery.pickupAddress && (
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                Collecte : {delivery.pickupAddress}
              </p>
            )}
          </>
        )}

        {!isHistorical && delivery.driverName && (
          <p className="mt-2 text-xs text-muted-foreground">{delivery.driverName}</p>
        )}

        <p className="mt-1 text-xs font-medium text-brand">{delivery.statusLabel}</p>

        {isHistorical && historyDate && (
          <p className="mt-1 text-xs text-muted-foreground">Terminée le {historyDate}</p>
        )}

        {purchasing && delivery.orderItems.length > 0 && (
          <div className="mt-3 space-y-1 rounded-lg bg-muted/40 p-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <ShoppingBag className="h-3 w-3" />
              Achats en cours
            </div>
            {delivery.orderItems.map((item) => (
              <div key={item.id} className="flex items-start gap-2 text-xs">
                <Package className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                <span>
                  {item.quantity}× {item.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </button>

      {isHistorical && (
        <ReorderOrderButton deliveryId={delivery.id} fullWidth className="mt-3" />
      )}
    </div>
  );
}

export function PortalDeliveriesMapPanel({
  activeDeliveries,
  historyDeliveries,
  selectedId,
  onSelect,
}: PortalDeliveriesMapPanelProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<MapTab>("active");

  const list = tab === "active" ? activeDeliveries : historyDeliveries;
  const selectedDelivery = list.find((delivery) => delivery.id === selectedId) ?? null;

  return (
    <div data-dispatch-map-panel className="pointer-events-auto w-[min(300px,calc(100vw-32px))]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-opacity hover:opacity-95"
        style={mapGlassCardStyle}
        aria-expanded={open}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          {tab === "history" ? <History className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {tab === "active" ? "Livraisons en cours" : "Historique"}
          </p>
          {selectedDelivery ? (
            <p className="truncate text-xs text-muted-foreground">
              {selectedDelivery.reference} · {selectedDelivery.statusLabel}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {list.length} livraison{list.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          className="mt-2 max-h-[min(420px,50vh)] overflow-hidden rounded-2xl"
          style={mapGlassCardStyle}
        >
          <div className="border-b border-white/70 p-2">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/60 p-1">
              <button
                type="button"
                onClick={() => setTab("active")}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                  tab === "active"
                    ? "bg-brand text-white shadow-sm"
                    : "text-muted-foreground hover:bg-white/80"
                )}
              >
                En cours ({activeDeliveries.length})
              </button>
              <button
                type="button"
                onClick={() => setTab("history")}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                  tab === "history"
                    ? "bg-brand text-white shadow-sm"
                    : "text-muted-foreground hover:bg-white/80"
                )}
              >
                Historique ({historyDeliveries.length})
              </button>
            </div>
          </div>

          <div className="max-h-[min(340px,42vh)] space-y-2 overflow-y-auto p-3">
            {list.length === 0 ? (
              <p className="px-1 py-3 text-sm text-muted-foreground">
                {tab === "active"
                  ? "Aucune livraison en cours à afficher."
                  : "Aucune livraison passée pour le moment."}
              </p>
            ) : (
              list.map((delivery) => (
                <DeliveryListItem
                  key={delivery.id}
                  delivery={delivery}
                  isSelected={selectedId === delivery.id}
                  isHistorical={delivery.isHistorical}
                  onSelect={() => {
                    onSelect(delivery.id);
                    setOpen(false);
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
