"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ShopRow } from "@/domains/shop/shop.service";
import type { ShopPriceBoard, ShopPriceInput } from "@/domains/shop/shop-prices.service";
import type { CreateShopInput, UpdateShopInput } from "@/lib/validations/shop";

export type { ShopRow };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let json: { error?: string; data?: T } = {};
  try {
    json = await res.json();
  } catch {
    if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Lot 2, demande 1 : boutiques de l'entreprise (administrateur) et boutique de la vendeuse. */
export const shopsApi = {
  list: () => call<ShopRow[]>("/api/shops"),
  create: (input: CreateShopInput) => call<ShopRow>("/api/shops", jsonInit("POST", input)),
  update: (id: string, input: UpdateShopInput) => call<ShopRow>(`/api/shops/${encodeURIComponent(id)}`, jsonInit("PATCH", input)),
  mine: () => call<ShopRow>("/api/shop"),
  // Lot 2, demande 4 : prix boutique (administrateur, sans code) et code responsable.
  prices: (id: string) => call<ShopPriceBoard>(`/api/shops/${encodeURIComponent(id)}/prices`),
  savePrices: (id: string, prices: ShopPriceInput[]) =>
    call<ShopPriceBoard>(`/api/shops/${encodeURIComponent(id)}/prices`, jsonInit("PUT", { prices })),
  resetCode: (id: string, code: string) => call<void>(`/api/shops/${encodeURIComponent(id)}/manager-code`, jsonInit("PUT", { code })),
  // Tablette : « Produits et prix » s'ouvre et s'enregistre avec le code responsable.
  unlockPrices: (code: string) => call<ShopPriceBoard>("/api/shop/prices", jsonInit("POST", { code })),
  saveMyPrices: (code: string, prices: ShopPriceInput[]) => call<ShopPriceBoard>("/api/shop/prices", jsonInit("PUT", { code, prices })),
  changeCode: (currentCode: string, newCode: string) => call<void>("/api/shop/manager-code", jsonInit("PUT", { currentCode, newCode })),
};

export function useShops() {
  return useQuery({ queryKey: ["shops", "list"], queryFn: shopsApi.list });
}

export function useMyShop() {
  return useQuery({ queryKey: ["shops", "mine"], queryFn: shopsApi.mine });
}

function useInvalidateShops() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["shops"] });
    void qc.invalidateQueries({ queryKey: ["users"] });
  };
}

export function useCreateShop() {
  const invalidate = useInvalidateShops();
  return useMutation({ mutationFn: shopsApi.create, onSuccess: invalidate });
}

export function useUpdateShop(id: string) {
  const invalidate = useInvalidateShops();
  return useMutation({ mutationFn: (input: UpdateShopInput) => shopsApi.update(id, input), onSuccess: invalidate });
}
