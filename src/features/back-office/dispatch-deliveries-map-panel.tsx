"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { DispatchMapDelivery } from "@/domains/delivery/dispatch-map.service";
import { isPurchasingPhase } from "@/features/back-office/dispatch-delivery-map-state";
import { mapGlassCardStyle } from "@/components/maps/map-glass-styles";
import { cn } from "@/lib/utils";
import { ChevronDown, Package, Search, ShoppingBag, Truck } from "lucide-react";
import type { DeliveryCategory } from "@prisma/client";

interface DispatchDeliveriesMapPanelProps {
  deliveries: DispatchMapDelivery[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function matchesDeliverySearch(delivery: DispatchMapDelivery, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    delivery.customerName,
    delivery.driverName,
    delivery.reference,
    delivery.address,
    delivery.pickupAddress,
    ...delivery.pickups.map((pickup) => pickup.address),
    ...delivery.pickups.map((pickup) => pickup.label),
  ];

  return haystack.some((value) => value?.toLowerCase().includes(q));
}

function deliveryBadgeClasses(category: DeliveryCategory) {
  return category === "COURIER"
    ? "border-transparent bg-blue-200/80 text-blue-900"
    : "border-transparent bg-rose-200/80 text-rose-900";
}

function DeliveryListItem({
  delivery,
  isSelected,
  onSelect,
}: {
  delivery: DispatchMapDelivery;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const purchasing = isPurchasingPhase(delivery);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition-colors",
        isSelected
          ? "border-brand/40 bg-white/95 shadow-sm"
          : "border-white/70 bg-white/70 hover:bg-white/90"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{delivery.reference}</span>
        <Badge className={deliveryBadgeClasses(delivery.deliveryCategory)}>
          {delivery.deliveryCategory === "COURIER" ? "Course" : "Commande"}
        </Badge>
      </div>

      {delivery.deliveryCategory === "STANDARD" && delivery.customerName && (
        <p className="mt-2 text-sm font-medium text-foreground">{delivery.customerName}</p>
      )}

      <p
        className={cn(
          "line-clamp-2 text-sm",
          delivery.deliveryCategory === "STANDARD" && delivery.customerName ? "mt-1" : "mt-2"
        )}
      >
        {delivery.address}
      </p>

      {delivery.pickups.length > 0 ? (
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {delivery.pickups.map((pickup) => (
            <p key={pickup.id} className="line-clamp-1">
              {pickup.label} : {pickup.address}
            </p>
          ))}
        </div>
      ) : (
        delivery.pickupAddress && (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            Collecte : {delivery.pickupAddress}
          </p>
        )
      )}

      {delivery.driverName && (
        <p className="mt-2 text-xs text-muted-foreground">{delivery.driverName}</p>
      )}

      {purchasing && delivery.orderItems.length > 0 && (
        <div className="mt-3 space-y-1 rounded-lg bg-muted/40 p-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <ShoppingBag className="h-3 w-3" />
            Courses en cours
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
  );
}

function DispatchDeliveriesList({
  deliveries,
  filteredDeliveries,
  selectedId,
  search,
  onSearchChange,
  onSelect,
}: {
  deliveries: DispatchMapDelivery[];
  filteredDeliveries: DispatchMapDelivery[];
  selectedId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  const hasSearch = search.trim().length > 0;

  return (
    <>
      <div className="border-b border-white/60 px-4 py-3">
        <p className="font-semibold text-foreground">Livraisons actives</p>
        <p className="text-xs text-muted-foreground">
          {hasSearch
            ? `${filteredDeliveries.length} / ${deliveries.length} sur la carte`
            : `${deliveries.length} sur la carte`}
        </p>
      </div>

      <div className="border-b border-white/60 px-3 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Client, livreur, n° livraison, adresse..."
            className="h-9 border-white/70 bg-white/80 pl-8 text-sm shadow-none"
          />
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {deliveries.length === 0 ? (
          <p className="px-1 py-4 text-sm text-muted-foreground">
            Aucune livraison active à afficher.
          </p>
        ) : filteredDeliveries.length === 0 ? (
          <p className="px-1 py-4 text-sm text-muted-foreground">
            Aucun résultat pour « {search.trim()} ».
          </p>
        ) : (
          filteredDeliveries.map((delivery) => (
            <DeliveryListItem
              key={delivery.id}
              delivery={delivery}
              isSelected={selectedId === delivery.id}
              onSelect={() => onSelect(delivery.id)}
            />
          ))
        )}
      </div>
    </>
  );
}

export function DispatchDeliveriesMapPanel({
  deliveries,
  selectedId,
  onSelect,
}: DispatchDeliveriesMapPanelProps) {
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredDeliveries = useMemo(
    () => deliveries.filter((delivery) => matchesDeliverySearch(delivery, search)),
    [deliveries, search]
  );

  const selectedDelivery = deliveries.find((delivery) => delivery.id === selectedId) ?? null;

  const handleSelect = (id: string) => {
    onSelect(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile : panneau repliable */}
      <div className="pointer-events-auto w-full max-md:block md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="flex w-full max-w-[min(360px,calc(100vw-32px))] items-center gap-3 rounded-2xl px-4 py-3 text-left transition-opacity hover:opacity-95"
          style={mapGlassCardStyle}
          aria-expanded={mobileOpen}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Truck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Livraisons actives</p>
            {selectedDelivery ? (
              <p className="truncate text-xs text-muted-foreground">
                {selectedDelivery.reference}
                {selectedDelivery.customerName ? ` · ${selectedDelivery.customerName}` : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {deliveries.length} livraison{deliveries.length > 1 ? "s" : ""}
              </p>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              mobileOpen && "rotate-180"
            )}
          />
        </button>

        {mobileOpen && (
          <div
            className="mt-2 flex max-h-[min(420px,50vh)] w-full max-w-[min(360px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl"
            style={mapGlassCardStyle}
          >
            <DispatchDeliveriesList
              deliveries={deliveries}
              filteredDeliveries={filteredDeliveries}
              selectedId={selectedId}
              search={search}
              onSearchChange={setSearch}
              onSelect={handleSelect}
            />
          </div>
        )}
      </div>

      {/* Desktop : panneau latéral fixe (inchangé) */}
      <div
        data-dispatch-map-panel
        className="pointer-events-auto hidden h-[calc(100dvh-32px)] w-[min(360px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl md:flex"
        style={mapGlassCardStyle}
      >
        <DispatchDeliveriesList
          deliveries={deliveries}
          filteredDeliveries={filteredDeliveries}
          selectedId={selectedId}
          search={search}
          onSearchChange={setSearch}
          onSelect={onSelect}
        />
      </div>
    </>
  );
}
