import type { StockRow } from "@/domains/shop/shop-stock.service";

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface StockGroup {
  shopId: string;
  shopName: string;
  inStock: number;
  toDiscard: number;
  rows: StockRow[];
}

/**
 * RETOURS-1 (tour de Théo, 21 novembre) : liste plus lisible — une carte par boutique, produits en ordre alphabétique,
 * ceux encore en stock d'abord ; filtre facultatif sur le nom du produit (sans tenir compte des accents).
 */
export function groupStockByShop(rows: readonly StockRow[], search = ""): StockGroup[] {
  const needle = fold(search.trim());
  const byShop = new Map<string, StockGroup>();
  for (const row of rows) {
    if (needle && !fold(row.productName).includes(needle)) continue;
    const group = byShop.get(row.shopId) ?? { shopId: row.shopId, shopName: row.shopName, inStock: 0, toDiscard: 0, rows: [] };
    group.inStock += row.inStock;
    group.toDiscard += row.toDiscardTonight;
    group.rows.push(row);
    byShop.set(row.shopId, group);
  }
  const groups = [...byShop.values()].sort((a, b) => a.shopName.localeCompare(b.shopName, "fr"));
  for (const group of groups) {
    group.rows.sort((a, b) => Number(b.inStock > 0) - Number(a.inStock > 0) || a.productName.localeCompare(b.productName, "fr"));
  }
  return groups;
}
