"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orderingApi } from "@/features/ordering/api";
import { useCartStore } from "@/features/ordering/cart-store";
import { ORDERING_KEYS } from "@/features/ordering/hooks";
import { fr } from "@/lib/i18n/fr";

/** Actions de l'historique vers le panier (CLI-06, CLI-08). */
export function useOrderActions() {
  const router = useRouter();
  const qc = useQueryClient();

  const fetchDetail = (id: string) => qc.fetchQuery({ queryKey: ORDERING_KEYS.order(id), queryFn: () => orderingApi.order(id) });

  return {
    /** CLI-08 : reprendre dans le panier pour la modifier (nouvelle date choisie dans le panier). */
    toCart: async (id: string) => {
      try {
        const order = await fetchDetail(id);
        const lines = order.lines.filter((line) => line.available).map((line) => ({ productId: line.productId, quantity: line.quantity }));
        const state = useCartStore.getState();
        state.load(lines, { orderId: null, slotId: order.slot.id });
        // La date reste celle du panier si elle est encore ouverte ; sinon l'écran Commander prend la première date ouverte.
        toast.success(fr.order.toCartDone);
        router.push("/portal");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : fr.common.genericError);
      }
    },
    /** CLI-06 : ouvrir une commande modifiable dans le panier, à sa date et son créneau. */
    edit: async (id: string) => {
      try {
        const order = await fetchDetail(id);
        const lines = order.lines.filter((line) => line.available).map((line) => ({ productId: line.productId, quantity: line.quantity }));
        useCartStore.getState().load(lines, { orderId: order.id, deliveryDate: order.deliveryDate, slotId: order.slot.id });
        router.push(`/portal?date=${order.deliveryDate}&slot=${encodeURIComponent(order.slot.id)}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : fr.common.genericError);
      }
    },
  };
}
