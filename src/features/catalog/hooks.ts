"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { catalogApi } from "./api";
import type { UpdateCategoryInput, UpdateProductInput, UpsertMerchantPriceInput, CreateProductInput } from "@/lib/validations/catalog";

const KEYS = {
  categories: ["catalog", "categories"] as const,
  products: ["catalog", "products"] as const,
  prices: (productId: string) => ["catalog", "prices", productId] as const,
  merchants: ["catalog", "merchants"] as const,
};

export function useCategories() {
  return useQuery({ queryKey: KEYS.categories, queryFn: catalogApi.categories });
}

export function useProducts() {
  return useQuery({ queryKey: KEYS.products, queryFn: catalogApi.products });
}

export function useMerchantChoices(enabled: boolean) {
  return useQuery({ queryKey: KEYS.merchants, queryFn: catalogApi.merchants, enabled, staleTime: 60_000 });
}

export function useProductPrices(productId: string | null) {
  return useQuery({
    queryKey: KEYS.prices(productId ?? ""),
    queryFn: () => catalogApi.prices({ productId: productId! }),
    enabled: Boolean(productId),
  });
}

function useInvalidateCatalog() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["catalog"] });
    // Le catalogue client affiche les mêmes produits et prix.
    void qc.invalidateQueries({ queryKey: ["portal", "catalog"] });
  };
}

export function useCreateCategory() {
  const invalidate = useInvalidateCatalog();
  return useMutation({ mutationFn: catalogApi.createCategory, onSuccess: invalidate });
}

export function useUpdateCategory() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) => catalogApi.updateCategory(id, input),
    onSuccess: invalidate,
  });
}

export function useReorderCategories() {
  const qc = useQueryClient();
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: catalogApi.reorderCategories,
    onSuccess: (rows) => {
      qc.setQueryData(KEYS.categories, rows);
      invalidate();
    },
  });
}

export function useSaveProduct() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: CreateProductInput | UpdateProductInput }) =>
      id ? catalogApi.updateProduct(id, input) : catalogApi.createProduct(input as CreateProductInput),
    onSuccess: invalidate,
  });
}

export function useProductPhoto() {
  const invalidate = useInvalidateCatalog();
  return {
    upload: useMutation({ mutationFn: ({ id, file }: { id: string; file: File }) => catalogApi.uploadPhoto(id, file), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => catalogApi.removePhoto(id), onSuccess: invalidate }),
  };
}

export function useUpsertPrice() {
  const invalidate = useInvalidateCatalog();
  return useMutation({ mutationFn: (input: UpsertMerchantPriceInput) => catalogApi.upsertPrice(input), onSuccess: invalidate });
}

export function useDeletePrice() {
  const invalidate = useInvalidateCatalog();
  return useMutation({ mutationFn: (id: string) => catalogApi.deletePrice(id), onSuccess: invalidate });
}
