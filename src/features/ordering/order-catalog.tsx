"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { History, Lock, Search, ShoppingBasket } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ProductThumb } from "@/features/catalog/product-thumb";
import { CartSheet } from "@/features/ordering/cart-sheet";
import { catalogSections } from "@/features/ordering/catalog-sections";
import { cartSyncAction } from "@/features/ordering/cart-sync";
import { useCartStore } from "@/features/ordering/cart-store";
import { DateSlotPicker } from "@/features/ordering/date-slot-picker";
import { useOrderLookup, usePortalCatalog } from "@/features/ordering/hooks";
import { ProductInfoDialog } from "@/features/ordering/product-info-dialog";
import { ProductPrice } from "@/features/ordering/promo-price";
import { QuantityStepper } from "@/features/ordering/quantity-stepper";
import { useCartLines } from "@/features/ordering/use-cart-lines";
import { orderCutoffInstant } from "@/domains/order/order-deadline";
import type { PortalProduct } from "@/domains/order/merchant-order.types";
import { deadlineLabel, shortDeliveryDateLabel } from "@/lib/format/delivery-date";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { useAuthStore } from "@/stores/auth.store";

const t = fr.order;

/**
 * Portail client, écran « Commander » (CMD-1), pensé mobile d'abord : date et créneau (CLI-05),
 * catalogue par catégorie au prix appliqué (CLI-03), + / − et saisie directe (CLI-04), panier.
 * Une commande existante pour la date et le créneau est ouverte en modification (RG-02).
 */
export function OrderCatalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = useAuthStore((state) => state.user?.id);
  const catalog = usePortalCatalog();
  const cart = useCartStore();
  const [query, setQuery] = useState("");
  const [info, setInfo] = useState<PortalProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { lines, totals, unavailable } = useCartLines(catalog.data);

  useEffect(() => {
    // Le panier est relu depuis sessionStorage après le premier rendu.
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (userId) cart.setOwner(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Date et créneau : paramètres d'URL (« Modifier » depuis une commande), sinon panier, sinon défauts.
  const rules = catalog.data?.rules;
  const slots = catalog.data?.slots;
  useEffect(() => {
    if (!rules || !slots || !hydrated) return;
    const wantedDate = searchParams.get("date");
    const wantedSlot = searchParams.get("slot");
    const state = useCartStore.getState();
    const date = wantedDate && wantedDate >= rules.firstOpenDate ? wantedDate : state.deliveryDate;
    if (!date || date < rules.firstOpenDate) state.setDeliveryDate(rules.firstOpenDate);
    else if (date !== state.deliveryDate) state.setDeliveryDate(date);
    const slot = wantedSlot && slots.some((item) => item.id === wantedSlot) ? wantedSlot : state.slotId;
    if (!slot || !slots.some((item) => item.id === slot)) {
      // Lot 1, D1 : client sans tournée → aucun créneau ; l'ancien créneau mémorisé ne doit plus servir.
      if (slots[0]) state.setSlot(slots[0].id);
      else if (state.slotId) useCartStore.setState({ slotId: null });
    } else if (slot !== state.slotId) state.setSlot(slot);
    if (wantedDate || wantedSlot) router.replace("/portal", { scroll: false });
  }, [rules, slots, hydrated, searchParams, router]);

  const lookup = useOrderLookup(hydrated ? cart.deliveryDate : null, hydrated ? cart.slotId : null);
  const existing = lookup.data && lookup.data.status !== "CANCELLED" ? lookup.data : null;
  const locked = Boolean(existing && !existing.editable);
  // Lot 1, D1 : sans tournée (aucun créneau), le catalogue reste consultable mais rien ne se commande.
  const noSlot = Boolean(slots && slots.length === 0);

  // CLI-05 : commande existante pour (date, créneau) → son contenu est chargé dans un panier vide.
  const [conflictWith, setConflictWith] = useState<string | null>(null);
  useEffect(() => {
    if (!hydrated || lookup.isFetching) return;
    const state = useCartStore.getState();
    const action = cartSyncAction({ existing, loadedOrderId: state.loadedOrderId, hasQuantities: Object.keys(state.quantities).length > 0 });
    if (action === "load" && existing) state.load(existing.lines.filter((line) => line.available), { orderId: existing.id });
    if (action === "clear") state.clear();
    setConflictWith(action === "conflict" && existing ? existing.id : null);
  }, [existing, hydrated, lookup.isFetching]);

  // Lot 1, demande 2 : les produits en promotion pour ce client passent en tête, dans une section « Promotions ».
  const filtered = useMemo(() => catalogSections(catalog.data?.categories ?? [], query), [catalog.data, query]);

  const sectionRefs = useRef(new Map<string, HTMLElement>());

  if (isInitialQueryLoading(catalog.isLoading, catalog.data) || !hydrated) return <PageSkeleton />;
  if (catalog.error || !catalog.data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{catalog.error instanceof Error ? catalog.error.message : fr.common.loadError}</AlertDescription>
      </Alert>
    );
  }

  const { categories } = catalog.data;
  const showBar = !noSlot && (totals.itemCount > 0 || Boolean(existing));

  return (
    <div className="space-y-5 pb-28">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.nextDelivery(
              shortDeliveryDateLabel(catalog.data.rules.firstOpenDate),
              deadlineLabel(orderCutoffInstant(catalog.data.rules.firstOpenDate, catalog.data.rules.cutoffTime, catalog.data.rules.timeZone), catalog.data.rules.timeZone)
            )}
          </p>
        </div>
        <Button asChild variant="outline" size="touch" className="shrink-0">
          <Link href="/portal/orders?tab=history">
            <History /> {t.reorder}
          </Link>
        </Button>
      </div>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <DateSlotPicker
          rules={catalog.data.rules}
          slots={catalog.data.slots}
          date={cart.deliveryDate}
          slotId={cart.slotId}
          onDate={cart.setDeliveryDate}
          onSlot={cart.setSlot}
        />
        {existing && !noSlot ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm" role="status" data-testid="existing-order-banner">
            {locked ? <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : null}
            <div className="min-w-0">
              <p className="font-medium">{locked ? t.lockedOrder : t.existingOrder}</p>
              <p className="text-muted-foreground">
                {existing.reference} · {existing.editable ? t.editableUntil(deadlineLabel(existing.cutoffAt, catalog.data.rules.timeZone)) : t.lockedSince(deadlineLabel(existing.cutoffAt, catalog.data.rules.timeZone))}
              </p>
              {conflictWith ? (
                <Button
                  type="button" variant="link" className="h-auto p-0"
                  onClick={() => { cart.load(existing.lines.filter((line) => line.available), { orderId: existing.id }); setConflictWith(null); }}
                >
                  Afficher le contenu de cette commande
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {categories.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t.catalogEmpty}</p>
      ) : (
        <>
          <div className="sticky top-[3.6rem] z-20 -mx-3 space-y-2 bg-background/95 px-3 pb-2 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-4 sm:px-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} className="h-11 pl-9" />
            </div>
            <nav aria-label="Catégories" className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none]">
              {filtered.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className="inline-flex min-h-9 shrink-0 items-center rounded-full border bg-card px-3 text-sm hover:bg-muted"
                  onClick={() => sectionRefs.current.get(category.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  {category.name}
                </button>
              ))}
            </nav>
          </div>

          {filtered.map((category) => (
            <section
              key={category.id}
              ref={(element) => { if (element) sectionRefs.current.set(category.id, element); }}
              className="scroll-mt-36"
              aria-labelledby={`cat-${category.id}`}
            >
              <h2 id={`cat-${category.id}`} className="mb-1 text-lg font-semibold">{category.name}</h2>
              <ul className="divide-y rounded-2xl border bg-card px-3">
                {category.products.map((product) => (
                  <li key={product.id} className="flex items-center gap-3 py-3" data-testid={`portal-product-${product.name}`}>
                    {/* Lot 1, demande 3 : toucher le produit affiche ses allergènes. */}
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setInfo(product)}
                      aria-label={t.productInfo(product.name)}
                      data-testid="portal-product-open"
                    >
                      <ProductThumb productId={product.id} photoVersion={product.photoVersion} className="h-14 w-14 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          <ProductPrice product={product} />
                          {" "}{fr.common.exclVat} · {product.unit}
                        </p>
                        {product.isSpecific && !product.promo ? <Badge variant="brand" className="mt-1">{t.priceSpecific}</Badge> : null}
                      </div>
                    </button>
                    <QuantityStepper
                      productName={product.name}
                      value={cart.quantities[product.id] ?? 0}
                      onChange={(value) => cart.setQuantity(product.id, value)}
                      disabled={locked || noSlot}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {/* Barre du panier rendue dans <body> : un ancêtre animé (transform) la détacherait du bas de l'écran. */}
      {showBar ? createPortal(
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85" data-testid="cart-bar">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <ShoppingBasket className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{t.items(totals.itemCount)}</p>
              <p className="tabular-nums text-muted-foreground">{formatCents(totals.subtotalCents)} {fr.common.exclVat}</p>
            </div>
            <Button variant="brand" size="touch" className="rounded-full px-6" onClick={() => setCartOpen(true)}>
              {t.viewCart}
            </Button>
          </div>
        </div>,
        document.body
      ) : null}

      <ProductInfoDialog product={info} onClose={() => setInfo(null)} />

      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        catalog={catalog.data}
        lines={lines}
        totals={totals}
        unavailable={unavailable}
        existing={existing}
        onSaved={(orderId) => router.push(`/portal/orders/${orderId}?saved=1`)}
      />
    </div>
  );
}
