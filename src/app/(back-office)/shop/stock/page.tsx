import { StockTable } from "@/features/shops/stock-table";

/** Lot 2, demande 8 : stock de la boutique de la vendeuse. */
export default function Page() {
  return <StockTable endpoint="/api/shop/stock" title="Stock de mon point de vente" showShopFilter={false} />;
}
