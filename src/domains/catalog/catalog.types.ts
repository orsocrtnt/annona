/** Lignes du catalogue renvoyées par l'API back-office (CAT-1). */

export interface CategoryRow {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  productCount: number;
}

export interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  categoryActive: boolean;
  unit: string;
  basePriceCents: number;
  vatRateBasisPoints: number;
  active: boolean;
  hasPhoto: boolean;
  /** Version de la photo (cache du navigateur) ; vide sans photo. */
  photoVersion: string | null;
  specificPriceCount: number;
}

export interface MerchantPriceRow {
  id: string;
  merchantId: string;
  merchantName: string;
  productId: string;
  productName: string;
  priceCents: number;
  basePriceCents: number;
}
