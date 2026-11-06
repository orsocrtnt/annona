import type { CategoryRow, MerchantPriceRow, ProductRow } from "@/domains/catalog/catalog.types";
import type {
  CreateCategoryInput,
  CreateProductInput,
  UpdateCategoryInput,
  UpdateProductInput,
  UpsertMerchantPriceInput,
} from "@/lib/validations/catalog";

export type { CategoryRow, MerchantPriceRow, ProductRow };

export interface MerchantChoice {
  id: string;
  name: string;
  legalName: string;
  active: boolean;
}

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

/** Back-office catalogue (CAT-1). */
export const catalogApi = {
  categories: () => call<CategoryRow[]>("/api/catalog/categories"),
  createCategory: (input: CreateCategoryInput) => call<CategoryRow>("/api/catalog/categories", jsonInit("POST", input)),
  updateCategory: (id: string, input: UpdateCategoryInput) =>
    call<CategoryRow>(`/api/catalog/categories/${encodeURIComponent(id)}`, jsonInit("PATCH", input)),
  reorderCategories: (ids: string[]) => call<CategoryRow[]>("/api/catalog/categories/order", jsonInit("PUT", { ids })),
  products: () => call<ProductRow[]>("/api/catalog/products"),
  createProduct: (input: CreateProductInput) => call<ProductRow>("/api/catalog/products", jsonInit("POST", input)),
  updateProduct: (id: string, input: UpdateProductInput) =>
    call<ProductRow>(`/api/catalog/products/${encodeURIComponent(id)}`, jsonInit("PATCH", input)),
  uploadPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append("photo", file);
    return call<{ photoVersion: string }>(`/api/catalog/products/${encodeURIComponent(id)}/photo`, { method: "POST", body: form });
  },
  removePhoto: (id: string) => call<void>(`/api/catalog/products/${encodeURIComponent(id)}/photo`, { method: "DELETE" }),
  prices: (filter: { productId?: string; merchantId?: string }) => {
    const params = new URLSearchParams();
    if (filter.productId) params.set("productId", filter.productId);
    if (filter.merchantId) params.set("merchantId", filter.merchantId);
    return call<MerchantPriceRow[]>(`/api/catalog/prices?${params}`);
  },
  upsertPrice: (input: UpsertMerchantPriceInput) => call<{ id: string }>("/api/catalog/prices", jsonInit("PUT", input)),
  deletePrice: (id: string) => call<void>(`/api/catalog/prices/${encodeURIComponent(id)}`, { method: "DELETE" }),
  merchants: () => call<MerchantChoice[]>("/api/catalog/merchants"),
};

/** URL de la photo d'un produit (même entreprise), versionnée pour le cache du navigateur. */
export function productPhotoUrl(productId: string, version: string | null): string | null {
  return version ? `/api/catalog/products/${encodeURIComponent(productId)}/photo?v=${version}` : null;
}
