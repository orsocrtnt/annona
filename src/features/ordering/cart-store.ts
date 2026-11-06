"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_LINE_QUANTITY } from "@/lib/validations/order";

/**
 * Panier du client (CLI-04) : quantités par produit, date et créneau choisis (CLI-05). Conservé
 * pour l'onglet en cours (sessionStorage) et rattaché au compte connecté (`ownerId`).
 * `loadedOrderId` : commande existante dont le contenu a été chargé dans le panier.
 */
export interface CartState {
  ownerId: string | null;
  deliveryDate: string | null;
  slotId: string | null;
  quantities: Record<string, number>;
  loadedOrderId: string | null;
  setOwner: (ownerId: string) => void;
  setDeliveryDate: (date: string) => void;
  setSlot: (slotId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  /** Remplace le contenu du panier (commande existante ou reprise depuis l'historique). */
  load: (lines: ReadonlyArray<{ productId: string; quantity: number }>, options?: { orderId?: string | null; deliveryDate?: string; slotId?: string }) => void;
  clear: () => void;
}

export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_LINE_QUANTITY, Math.max(0, Math.trunc(value)));
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      ownerId: null,
      deliveryDate: null,
      slotId: null,
      quantities: {},
      loadedOrderId: null,
      setOwner: (ownerId) => {
        if (get().ownerId !== ownerId) set({ ownerId, deliveryDate: null, slotId: null, quantities: {}, loadedOrderId: null });
      },
      setDeliveryDate: (deliveryDate) => set({ deliveryDate }),
      setSlot: (slotId) => set({ slotId }),
      setQuantity: (productId, quantity) =>
        set((state) => {
          const next = { ...state.quantities };
          const value = clampQuantity(quantity);
          if (value === 0) delete next[productId];
          else next[productId] = value;
          return { quantities: next };
        }),
      load: (lines, options = {}) =>
        set((state) => ({
          quantities: Object.fromEntries(lines.filter((line) => line.quantity > 0).map((line) => [line.productId, clampQuantity(line.quantity)])),
          loadedOrderId: options.orderId ?? null,
          deliveryDate: options.deliveryDate ?? state.deliveryDate,
          slotId: options.slotId ?? state.slotId,
        })),
      clear: () => set({ quantities: {}, loadedOrderId: null }),
    }),
    { name: "annona-cart", storage: createJSONStorage(() => sessionStorage) }
  )
);
