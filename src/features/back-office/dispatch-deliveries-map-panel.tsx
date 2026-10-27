"use client";

import { MissionAcknowledgement } from "@/components/shared/mission-acknowledgement";
import { withoutRolePrefix } from "@/lib/format/person-labels";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { DispatchMapDelivery } from "@/domains/delivery/dispatch-map.service";
import { isPurchasingPhase } from "@/features/back-office/dispatch-delivery-map-state";
import { getDispatchMapStatus, getDispatchMapStatusMeta } from "@/features/back-office/dispatch-map-status";
import { mapGlassCardStyle } from "@/components/maps/map-glass-styles";
import { cn } from "@/lib/utils";
import { ChevronDown, Package, Search, ShoppingBag, Truck } from "lucide-react";
import type { DeliveryCategory } from "@prisma/client";

interface DispatchDeliveriesMapPanelProps {
  deliveries: DispatchMapDelivery[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  focusSelectedId?: string | null;
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
    ? "border-transparent bg-[#f1f3f1] text-[#3f4842]"
    : "border-transparent bg-[#e9ece9] text-[#0e1310]";
}

function DeliveryListItem({
  delivery,
  isSelected,
  onSelect,
  shouldFocus = false,
}: {
  delivery: DispatchMapDelivery;
  isSelected: boolean;
  onSelect: () => void;
  shouldFocus?: boolean;
}) {
  const purchasing = isPurchasingPhase(delivery);
  const status = getDispatchMapStatusMeta(getDispatchMapStatus(delivery));
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!shouldFocus) return;
    buttonRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    buttonRef.current?.focus({ preventScroll: true });
  }, [shouldFocus]);

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={onSelect}
      aria-pressed={isSelected}
      title="Clic : sélectionner ou désélectionner · double-clic : voir le détail"
      className={cn(
        "w-full rounded-xl border p-3 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2",
        isSelected
          ? "border-[#cfe9d9] bg-[#f1f6f2] shadow-[inset_3px_0_0_#00d46a]"
          : "border-transparent bg-white/90 hover:border-[#e4e8e5] hover:bg-white"
      )}
    >
      {/* Le client (ou l'adresse) identifie la livraison ; la référence reste en petit. */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {withoutRolePrefix(delivery.customerName) || delivery.address}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">{delivery.reference}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", status.pill)}>
          {status.label}
        </span>
      </div>
      <Badge className={cn("mt-1.5", deliveryBadgeClasses(delivery.deliveryCategory))}>
        {delivery.deliveryCategory === "COURIER" ? "Course" : "Commande"}
      </Badge>

      {delivery.customerName && <p className="mt-2 line-clamp-2 text-sm">{delivery.address}</p>}

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

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {delivery.driverName && (
          <p className="text-xs text-muted-foreground">Livreur : {withoutRolePrefix(delivery.driverName)}</p>
        )}
        <MissionAcknowledgement {...delivery} compact />
      </div>

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
  focusSelectedId,
}: {
  deliveries: DispatchMapDelivery[];
  filteredDeliveries: DispatchMapDelivery[];
  selectedId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  focusSelectedId?: string | null;
}) {
  const hasSearch = search.trim().length > 0;

  return (
    <>
      <div className="border-b border-black/10 px-4 py-3">
        <p className="font-semibold text-foreground">Livraisons actives</p>
        <p className="text-xs text-muted-foreground">
          {hasSearch
            ? `${filteredDeliveries.length} / ${deliveries.length} sur la carte`
            : `${deliveries.length} sur la carte`}
        </p>
      </div>

      <div className="border-b border-black/10 px-3 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Client, livreur, n° livraison, adresse..."
            className="h-9 border-zinc-200 bg-white pl-8 text-sm shadow-none focus-visible:ring-black"
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
              shouldFocus={focusSelectedId === delivery.id}
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
  focusSelectedId = null,
}: DispatchDeliveriesMapPanelProps) {
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredDeliveries = useMemo(
    () => deliveries.filter((delivery) => matchesDeliverySearch(delivery, search)),
    [deliveries, search]
  );

  const selectedDelivery = deliveries.find((delivery) => delivery.id === selectedId) ?? null;

  useEffect(() => {
    if (!focusSelectedId) return;
    setSearch("");
    setMobileOpen(true);
  }, [focusSelectedId]);

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
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white">
            <Truck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Livraisons actives</p>
            {selectedDelivery ? (
              <p className="truncate text-xs text-muted-foreground">
                {selectedDelivery.customerName ? `${withoutRolePrefix(selectedDelivery.customerName)} · ` : ""}
                {selectedDelivery.reference}
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
              focusSelectedId={focusSelectedId}
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
          focusSelectedId={focusSelectedId}
        />
      </div>
    </>
  );
}
