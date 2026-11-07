/**
 * FACT-1 — contenu d'une facture de période, calculé sur les quantités LIVRÉES (RG-06) et le prix
 * unitaire HT figé au verrouillage (RG-05). Fonction pure : le service de génération charge les
 * commandes, ce module calcule les lignes, la TVA par taux et les totaux en centimes.
 *
 * - Les lignes sont regroupées par produit, prix unitaire et taux de TVA (un changement de prix dans
 *   la période donne deux lignes) ; une quantité livrée nulle (manquant total) ne donne aucune ligne.
 * - TVA arrondie au centime par taux (HALF_UP sur le cumul HT du taux), comme le Factur-X.
 * - Une commande dont une ligne n'a pas de prix figé n'est pas facturée : elle est signalée.
 */
import { computeTotals } from "@/domains/catalog/pricing";

export interface BillableOrderLine {
  productId: string;
  name: string;
  unit: string | null;
  quantityOrdered: number;
  /** Quantité réellement livrée ; vide seulement si la commande n'a jamais été préparée. */
  quantityDelivered: number | null;
  unitPriceFrozenCents: number | null;
  vatRateBasisPoints: number;
}

export interface BillableOrder {
  id: string;
  reference: string;
  /** « AAAA-MM-JJ ». */
  deliveryDate: string;
  lines: BillableOrderLine[];
}

export interface BuiltInvoiceLine {
  productId: string;
  label: string;
  unit: string | null;
  quantity: number;
  unitPriceCents: number;
  vatRateBasisPoints: number;
  totalCents: number;
  sortOrder: number;
}

export interface VatBreakdownRow {
  vatRateBasisPoints: number;
  baseCents: number;
  vatCents: number;
}

export interface BuiltInvoiceOrder {
  id: string;
  reference: string;
  deliveryDate: string;
  /** Montant HT livré de la commande (0 si tout a manqué). */
  subtotalCents: number;
}

export interface BuiltInvoice {
  lines: BuiltInvoiceLine[];
  orders: BuiltInvoiceOrder[];
  vatBreakdown: VatBreakdownRow[];
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  /** Commandes écartées (prix non figé) : à signaler, jamais facturées au hasard. */
  skipped: Array<{ id: string; reference: string; reason: "PRICE_NOT_FROZEN" }>;
}

/** Quantité facturée d'une ligne : la quantité livrée (RG-06). */
export function billedQuantity(line: Pick<BillableOrderLine, "quantityOrdered" | "quantityDelivered">): number {
  return line.quantityDelivered ?? line.quantityOrdered;
}

/** TVA d'un cumul HT à un taux donné (points de base), arrondie au centime. */
export function vatOf(baseCents: number, vatRateBasisPoints: number): number {
  return Math.round((baseCents * vatRateBasisPoints) / 10_000);
}

export function buildInvoice(orders: readonly BillableOrder[]): BuiltInvoice {
  const skipped: BuiltInvoice["skipped"] = [];
  const billable = orders.filter((order) => {
    const missingPrice = order.lines.some((line) => billedQuantity(line) > 0 && line.unitPriceFrozenCents === null);
    if (missingPrice) skipped.push({ id: order.id, reference: order.reference, reason: "PRICE_NOT_FROZEN" });
    return !missingPrice;
  });

  const grouped = new Map<string, Omit<BuiltInvoiceLine, "totalCents" | "sortOrder">>();
  const builtOrders: BuiltInvoiceOrder[] = [];
  for (const order of [...billable].sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate) || a.reference.localeCompare(b.reference))) {
    let orderSubtotal = 0;
    for (const line of order.lines) {
      const quantity = billedQuantity(line);
      if (quantity <= 0) continue;
      const unitPriceCents = line.unitPriceFrozenCents!;
      orderSubtotal += quantity * unitPriceCents;
      const key = `${line.productId}|${unitPriceCents}|${line.vatRateBasisPoints}`;
      const existing = grouped.get(key);
      if (existing) existing.quantity += quantity;
      else grouped.set(key, { productId: line.productId, label: line.name, unit: line.unit, quantity, unitPriceCents, vatRateBasisPoints: line.vatRateBasisPoints });
    }
    builtOrders.push({ id: order.id, reference: order.reference, deliveryDate: order.deliveryDate, subtotalCents: orderSubtotal });
  }

  const lines = [...grouped.values()]
    .sort((a, b) => a.label.localeCompare(b.label, "fr") || a.unitPriceCents - b.unitPriceCents || a.vatRateBasisPoints - b.vatRateBasisPoints)
    .map((line, index) => ({ ...line, totalCents: line.quantity * line.unitPriceCents, sortOrder: index }));

  const byRate = new Map<number, number>();
  for (const line of lines) byRate.set(line.vatRateBasisPoints, (byRate.get(line.vatRateBasisPoints) ?? 0) + line.totalCents);
  const vatBreakdown = [...byRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([vatRateBasisPoints, baseCents]) => ({ vatRateBasisPoints, baseCents, vatCents: vatOf(baseCents, vatRateBasisPoints) }));
  // Même calcul que les commandes (computeTotals) : une seule règle d'arrondi dans l'application.
  const totals = computeTotals(lines.map((line) => ({ quantity: line.quantity, unitPriceCents: line.unitPriceCents, vatRateBasisPoints: line.vatRateBasisPoints })));

  return { lines, orders: builtOrders, vatBreakdown, subtotalCents: totals.subtotalCents, vatCents: totals.vatCents, totalCents: totals.totalCents, skipped };
}
