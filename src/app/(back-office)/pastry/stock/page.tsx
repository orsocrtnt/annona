import { StockTable } from "@/features/shops/stock-table";

/** Lot 2, demande 8 : stock des boutiques, pâtisserie (pâtissier). */
export default function Page() {
  return <StockTable endpoint="/api/stock" />;
}
