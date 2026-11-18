"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ShopRow } from "@/domains/shop/shop.service";
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
