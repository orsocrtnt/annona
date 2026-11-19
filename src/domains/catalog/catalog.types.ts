/** Lignes du catalogue renvoyées par l'API back-office (CAT-1). */

export interface CategoryRow {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  /** Lot 2, demande 2 : pain (boulanger) ou pâtisserie (pâtissier). */
  family: "BREAD" | "PASTRY";
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
  basePriceCents: number | null;
  vatRateBasisPoints: number;
  active: boolean;
  hasPhoto: boolean;
  /** Version de la photo (cache du navigateur) ; vide sans photo. */
  photoVersion: string | null;
  specificPriceCount: number;
  /** Lot 1, demande 3 : null = non renseignés ; [] = aucun allergène. */
  allergens: string[] | null;
  /** Lot 2, demande 2 : famille de la catégorie. */
  family: "BREAD" | "PASTRY";
  /** Lot 2, demande 3 : petite pièce ou gros gâteau (pâtisserie) ; vide pour le pain. */
  pastryFormat: "SMALL" | "LARGE" | null;
  /** Lot 2, demande 3 : jamais renvoyée aux vendeuses, aux livreurs ni aux clients (routes réservées). */
  recipe: string | null;
  shelfLifeDays: number;
  /** Lot 2, demande 3 : tailles d'un gros gâteau, par nombre de parts croissant, avec leur prix restaurant. */
  sizes: ProductSizeRow[];
  /** Lot 2, demande 4 : prix restaurant manquant (produit, ou une taille d'un gros gâteau). */
  missingRestaurantPrice: boolean;
}

export interface ProductSizeRow {
  id: string;
  servings: number;
  restaurantPriceCents: number | null;
}

export interface MerchantPriceRow {
  id: string;
  merchantId: string;
  merchantName: string;
  productId: string;
  productName: string;
  priceCents: number;
  basePriceCents: number | null;
}
