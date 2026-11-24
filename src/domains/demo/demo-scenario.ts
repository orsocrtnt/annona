/**
 * DEMO-1 — journée de démonstration d'un environnement du lot de démo, calculée à l'heure de Paris.
 *
 * Une boulangerie, 100 produits, 172 clients à Paris, deux livreurs. Volumes de Théo (13 novembre 2026) : tournées du
 * matin de 5h30 à 12h30 et de l'après-midi de 15h à 19h ; 60 à 70 arrêts par tournée du matin ; 15 à 20 produits par
 * livraison ; jamais plus de 200 arrêts par jour. Une semaine d'historique livré, la journée en cours remise à
 * l'heure (arrêts déjà livrés, tournée en cours), le lendemain commandé.
 *
 * Lot 2 (pâtissier et vente en boutique, 24 novembre 2026) : pâtisseries et gâteaux en famille « pâtisserie », quatre
 * gros gâteaux vendus par taille, deux boutiques de l'entreprise sur les tournées du matin. Chaque matin, un envoi de
 * pain et de pâtisserie par boutique ; les jours passés, réception notée, stock par lots et clôture du soir (mêmes
 * règles que la tablette, `stock-rules.ts`) ; aujourd'hui, réception et clôture restent à faire sur la tablette.
 * Commandes de gâteaux de particuliers : soldées les jours passés, à retirer aujourd'hui et demain.
 *
 * Fonction pure et déterministe : mêmes (environnement, jour) → mêmes données. L'écriture en base et les comptes de
 * connexion sont faits ailleurs (lot de démo).
 */
import type { BillingPeriod, OrderStatus, PaymentMethod, Prisma, RoundStatus, StopStatus, SystemRole } from "@prisma/client";
import { DEMO_CATALOG } from "@/domains/demo/demo-catalog";
import { improveOpenPath } from "@/lib/dispatch/round-improve";
import { straightLineSeconds } from "@/lib/dispatch/travel-time";
import {
  DEMO_ACCESS_INSTRUCTIONS,
  DEMO_CAKE_CUSTOMERS,
  DEMO_FIRST_NAMES,
  DEMO_LARGE_CAKE_CATEGORY,
  DEMO_LARGE_CAKES,
  DEMO_LAST_NAMES,
  DEMO_MERCHANT_TYPES,
  DEMO_MERCHANT_WORDS,
  DEMO_PASTRY_CATEGORIES,
  DEMO_QUANTITY_RANGES,
  DEMO_RECIPES,
  DEMO_SHELF_LIFE_BY_CATEGORY,
  DEMO_SHELF_LIFE_BY_PRODUCT,
  DEMO_SHOP_ASSORTMENT,
  DEMO_SHOPS,
  DEMO_STREETS_NORTH,
  DEMO_STREETS_SOUTH,
  type DemoStreet,
} from "@/domains/demo/demo-scenario-data";
import { lastSaleDayOf, planClose, type StockLot } from "@/domains/shop/stock-rules";
import { addCalendarDays, parisParts, parisWallTimeToUtc, type CalendarDate } from "@/lib/time/paris";

/** Domaine de toutes les adresses de la démo : réservé (RFC 2606), jamais livrable, refusé par la garde d'envoi. */
export const DEMO_EMAIL_DOMAIN = "demo.annona.example";

/** Espaces à essayer ; pâtissier (`pastry`) et vente en boutique (`seller`) : lot 2, ajoutés le 24 novembre 2026. */
export const DEMO_PERSONAS = ["admin", "baker", "driver", "client", "pastry", "seller"] as const;
export type DemoPersona = (typeof DEMO_PERSONAS)[number];

export const DEMO_SCENARIO = {
  morningMerchantsPerZone: 70,
  eveningMerchantsPerZone: 16,
  /** Clients qui ne commandent pas un jour de semaine, par tournée (minimum, maximum). */
  morningSkipped: [2, 8],
  eveningSkipped: [0, 3],
  usualProducts: 20,
  linesPerOrder: [15, 20],
  historyDays: 7,
  morning: { start: 5 * 60 + 30, end: 12 * 60 + 30 },
  evening: { start: 15 * 60, end: 19 * 60 },
  /** Heure limite de commande pour le lendemain (RG-01). */
  cutoff: 17 * 60,
  morningPreparedAt: 4 * 60 + 30,
  eveningPreparedAt: 13 * 60 + 30,
  /**
   * Avancement des tournées du jour hors de leur créneau (demande d'Orso du 23 novembre 2026 : « plus de courses en
   * cours pour mieux comprendre ») : à toute heure, les quatre tournées du jour roulent, chacune à un stade différent.
   * Dans son créneau, une tournée suit l'heure réelle ; en dehors, son créneau est décalé pour que maintenant tombe à
   * cette fraction du parcours. La tournée du soir Nord est celle du livreur de démo.
   */
  liveProgress: { nord_matin: 0.7, sud_matin: 0.45, nord_soir: 0.55, sud_soir: 0.3 },
  depot: { latitude: 48.8547, longitude: 2.3725, address: "8 rue de la Roquette", postalCode: "75011" },
} as const;

type ZoneKey = "nord" | "sud";
type PeriodKey = "matin" | "soir";

export type DemoScenarioUser = {
  id: string;
  persona: DemoPersona | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: SystemRole;
  merchantId: string | null;
};

export type DemoScenario = {
  slot: number;
  prefix: string;
  companyId: string;
  /** Jour de Paris de la journée racontée (AAAA-MM-JJ). */
  day: string;
  company: Prisma.CompanyCreateManyInput;
  categories: Prisma.CategoryCreateManyInput[];
  products: Prisma.ProductCreateManyInput[];
  /** Tailles des gros gâteaux (LOT2-D3). */
  productSizes: Prisma.ProductSizeCreateManyInput[];
  zones: Prisma.DeliveryZoneCreateManyInput[];
  slots: Prisma.SlotCreateManyInput[];
  /** Clients (172), puis les boutiques de l'entreprise (`kind: SHOP`, LOT2-D1). */
  merchants: Prisma.MerchantCreateManyInput[];
  merchantPrices: Prisma.MerchantPriceCreateManyInput[];
  /** Prix boutique TTC (LOT2-D4). */
  shopPrices: Prisma.ShopPriceCreateManyInput[];
  users: DemoScenarioUser[];
  recurringOrders: Prisma.RecurringOrderCreateManyInput[];
  recurringOrderLines: Prisma.RecurringOrderLineCreateManyInput[];
  /** Commandes de gâteaux des particuliers (LOT2-D9) ; à écrire avant les lignes d'envoi qui les portent. */
  cakeOrders: Prisma.CakeOrderCreateManyInput[];
  orders: Prisma.OrderCreateManyInput[];
  orderLines: Prisma.OrderLineCreateManyInput[];
  rounds: Prisma.RoundCreateManyInput[];
  stops: Prisma.StopCreateManyInput[];
  /** Stock des boutiques (LOT2-D6) et clôtures du soir des jours passés (LOT2-D7). */
  shopStockLots: Prisma.ShopStockLotCreateManyInput[];
  shopDayCloses: Prisma.ShopDayCloseCreateManyInput[];
};

const pad = (value: number, size = 2) => String(value).padStart(size, "0");
const dayKey = (date: CalendarDate) => `${date.year}${pad(date.month)}${pad(date.day)}`;
const isoDay = (date: CalendarDate) => `${date.year}-${pad(date.month)}-${pad(date.day)}`;
/** Jour civil stocké en colonne `date` : minuit UTC du jour de Paris. */
const dbDate = (date: CalendarDate) => new Date(Date.UTC(date.year, date.month - 1, date.day));
const isoWeekday = (date: CalendarDate) => ((dbDate(date).getUTCDay() + 6) % 7) + 1;
const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Préfixe des identifiants d'un environnement de démo : jamais partagé avec une autre entreprise. */
export function demoPoolPrefix(slot: number): string {
  if (!Number.isInteger(slot) || slot < 1 || slot > 99) throw new RangeError("Environnement de démo : numéro 1 à 99.");
  return `demopool_${pad(slot)}_`;
}

/** Compte à ouvrir pour essayer un espace (page /demo) : identifiant stable d'une reconstruction à l'autre. */
export function demoPersonaUserId(slot: number, persona: DemoPersona): string {
  return `${demoPoolPrefix(slot)}user_${persona}`;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (random: () => number, [min, max]: readonly [number, number]) => min + Math.floor(random() * (max - min + 1));

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Ordre de passage d'une tournée de démo depuis le laboratoire : plus proche voisin, puis la même amélioration que
 * les vraies tournées (2-opt + Or-opt, `improveOpenPath`, DISPATCH-OPTIM), temps à vol d'oiseau. Mesuré le 23 novembre
 * 2026 sur une journée : 1 814 min de route pour 30 tournées (plus proche voisin seul : 2 043 ; calcul complet
 * `orderRoundStops` : 1 835), construction en 0,2 s (calcul complet : 1,7 s).
 */
function demoRoundOrder<T extends { latitude: number; longitude: number }>(stops: readonly T[]): T[] {
  const remaining = [...stops];
  const ordered: T[] = [];
  let current: { latitude: number; longitude: number } = DEMO_SCENARIO.depot;
  while (remaining.length) {
    let best = 0;
    for (let i = 1; i < remaining.length; i += 1) {
      if (haversineKm(current, remaining[i]!) < haversineKm(current, remaining[best]!)) best = i;
    }
    const [next] = remaining.splice(best, 1);
    ordered.push(next!);
    current = next!;
  }
  const depot = { latitude: DEMO_SCENARIO.depot.latitude, longitude: DEMO_SCENARIO.depot.longitude };
  return improveOpenPath(depot, ordered, straightLineSeconds).map((index) => ordered[index]!);
}

/** Heure murale de Paris (minutes depuis minuit) d'un jour donné, en instant UTC ; un calcul de fuseau par jour. */
function dayClock(date: CalendarDate) {
  const noon = parisWallTimeToUtc(date, { hour: 12, minute: 0 }).getTime();
  const offset = noon - Date.UTC(date.year, date.month - 1, date.day, 12, 0);
  const midnight = Date.UTC(date.year, date.month - 1, date.day);
  return (minutes: number) => new Date(midnight + minutes * 60_000 + offset);
}

type MerchantPlan = {
  id: string;
  index: number;
  zone: ZoneKey;
  period: PeriodKey;
  latitude: number;
  longitude: number;
  usual: ReadonlyArray<readonly [productIndex: number, quantity: number]>;
  /** Boutique de l'entreprise (LOT2-D1) : reçoit chaque matin un envoi du laboratoire, ne commande pas. */
  shop?: { index: number; key: string; sellerId: string };
};

type SlotPhase = {
  round: RoundStatus;
  /** Créneau de la tournée ce jour-là (minutes depuis minuit, éventuellement décalé pour la démo). */
  window: { start: number; end: number };
  /** Arrêts livrés jusqu'à cette heure (minutes), `null` : aucun. */
  deliveredUntil: number | null;
  prepared: boolean;
  /** Heure de préparation des commandes (minutes). */
  preparedAt: number;
};

/**
 * État d'une tournée : jours passés terminés, lendemain pas encore parti. Le jour même, la tournée est toujours en
 * cours (DEMO_SCENARIO.liveProgress) : à l'heure réelle dans son créneau, sinon sur un créneau décalé autour de
 * maintenant, de même durée.
 */
function slotPhase(dayOffset: number, zone: ZoneKey, period: PeriodKey, clock: number): SlotPhase {
  const base = period === "matin" ? DEMO_SCENARIO.morning : DEMO_SCENARIO.evening;
  const basePreparedAt = period === "matin" ? DEMO_SCENARIO.morningPreparedAt : DEMO_SCENARIO.eveningPreparedAt;
  const window = { start: base.start, end: base.end };
  if (dayOffset < 0) return { round: "COMPLETED", window, deliveredUntil: window.end, prepared: true, preparedAt: basePreparedAt };
  if (dayOffset > 0) return { round: "DRAFT", window, deliveredUntil: null, prepared: false, preparedAt: basePreparedAt };
  if (clock >= base.start && clock < base.end) {
    return { round: "IN_PROGRESS", window, deliveredUntil: clock, prepared: true, preparedAt: basePreparedAt };
  }
  const duration = base.end - base.start;
  const start = clock - Math.round(duration * DEMO_SCENARIO.liveProgress[`${zone}_${period}`]);
  return {
    round: "IN_PROGRESS",
    window: { start, end: start + duration },
    deliveredUntil: clock,
    prepared: true,
    preparedAt: start - (base.start - basePreparedAt),
  };
}

export function buildDemoScenario({ slot, now }: { slot: number; now: Date }): DemoScenario {
  const prefix = demoPoolPrefix(slot);
  const id = (...parts: Array<string | number>) => `${prefix}${parts.join("_")}`;
  const companyId = id("company");
  const parts = parisParts(now);
  const today: CalendarDate = { year: parts.year, month: parts.month, day: parts.day };
  const clockNow = parts.hour * 60 + parts.minute;
  const base = { companyId };

  // Catalogue.
  const categories: Prisma.CategoryCreateManyInput[] = [];
  const products: Prisma.ProductCreateManyInput[] = [];
  const productCategory: string[] = [];
  const categoryProducts = new Map<string, number[]>();
  for (const [categoryIndex, category] of DEMO_CATALOG.entries()) {
    const categoryId = id("category", category.id);
    const pastry = DEMO_PASTRY_CATEGORIES.has(category.id);
    categories.push({ ...base, id: categoryId, name: category.name, sortOrder: categoryIndex, family: pastry ? "PASTRY" : "BREAD" });
    for (const [productIndex, [name, unit, basePriceCents]] of category.products.entries()) {
      categoryProducts.set(category.id, [...(categoryProducts.get(category.id) ?? []), products.length]);
      productCategory.push(category.id);
      products.push({
        ...base,
        id: id("product", slugify(name)),
        categoryId,
        name,
        unit,
        basePriceCents,
        vatRateBasisPoints: 550,
        sortOrder: productIndex,
        active: true,
        pastryFormat: pastry ? "SMALL" : null,
        recipe: DEMO_RECIPES[name] ?? null,
        shelfLifeDays: DEMO_SHELF_LIFE_BY_PRODUCT[name] ?? DEMO_SHELF_LIFE_BY_CATEGORY[category.id] ?? 1,
      });
    }
  }
  const productId = (index: number) => products[index]!.id!;
  const productIndexByName = new Map(products.map((product, index) => [product.name, index]));

  // Gros gâteaux sur commande (LOT2-D3) : prix par taille, pas de prix unique ; jamais dans les commandes des clients.
  const largeCategoryId = id("category", DEMO_LARGE_CAKE_CATEGORY.id);
  categories.push({ ...base, id: largeCategoryId, name: DEMO_LARGE_CAKE_CATEGORY.name, sortOrder: DEMO_CATALOG.length, family: "PASTRY" });
  const productSizes: Prisma.ProductSizeCreateManyInput[] = [];
  const largeCakes = DEMO_LARGE_CAKES.map((cake, cakeIndex) => {
    const cakeProductId = id("product", slugify(cake.name));
    products.push({
      ...base,
      id: cakeProductId,
      categoryId: largeCategoryId,
      name: cake.name,
      unit: "gâteau",
      basePriceCents: null,
      vatRateBasisPoints: 550,
      sortOrder: cakeIndex,
      active: true,
      pastryFormat: "LARGE",
      recipe: DEMO_RECIPES[cake.name] ?? null,
      shelfLifeDays: 2,
    });
    const sizes = cake.sizes.map(([servings, restaurantPriceCents]) => {
      const size = { ...base, id: id("size", slugify(cake.name), servings), productId: cakeProductId, servings, restaurantPriceCents };
      productSizes.push(size);
      return size;
    });
    return { productId: cakeProductId, sizes };
  });

  // Tournées : deux zones, chacune avec le matin et l'après-midi.
  const zoneId = (zone: ZoneKey) => id("zone", zone);
  const slotId = (zone: ZoneKey, period: PeriodKey) => id("slot", zone, period);
  const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  const zones: Prisma.DeliveryZoneCreateManyInput[] = (["nord", "sud"] as const).map((zone, index) => ({
    ...base,
    id: zoneId(zone),
    name: zone === "nord" ? "Nord" : "Sud",
    morningStart: hhmm(DEMO_SCENARIO.morning.start),
    morningEnd: hhmm(DEMO_SCENARIO.morning.end),
    eveningStart: hhmm(DEMO_SCENARIO.evening.start),
    eveningEnd: hhmm(DEMO_SCENARIO.evening.end),
    active: true,
    sortOrder: index,
  }));
  const slots: Prisma.SlotCreateManyInput[] = (["nord", "sud"] as const).flatMap((zone, zoneIndex) =>
    (["matin", "soir"] as const).map((period, periodIndex) => {
      const window = period === "matin" ? DEMO_SCENARIO.morning : DEMO_SCENARIO.evening;
      return {
        ...base,
        id: slotId(zone, period),
        zoneId: zoneId(zone),
        period: period === "matin" ? ("MORNING" as const) : ("EVENING" as const),
        label: `${zone === "nord" ? "Nord" : "Sud"} ${period}`,
        startTime: hhmm(window.start),
        endTime: hhmm(window.end),
        active: true,
        sortOrder: periodIndex * 2 + zoneIndex,
      };
    })
  );

  // Clients : 70 du matin et 16 de l'après-midi par zone.
  const random = prng(slot * 7919);
  const plans: MerchantPlan[] = [];
  const merchants: Prisma.MerchantCreateManyInput[] = [];
  const merchantPrices: Prisma.MerchantPriceCreateManyInput[] = [];
  const perZone = DEMO_SCENARIO.morningMerchantsPerZone + DEMO_SCENARIO.eveningMerchantsPerZone;
  const billing: BillingPeriod[] = ["MONTHLY", "WEEKLY", "MONTHLY", "DAILY"];
  const payment: PaymentMethod[] = ["PRELEVEMENT", "VIREMENT", "VIREMENT", "ESPECES"];
  for (let index = 0; index < perZone * 2; index += 1) {
    const zone: ZoneKey = index < perZone ? "nord" : "sud";
    const inZone = index % perZone;
    const period: PeriodKey = inZone < DEMO_SCENARIO.morningMerchantsPerZone ? "matin" : "soir";
    const streets: readonly DemoStreet[] = zone === "nord" ? DEMO_STREETS_NORTH : DEMO_STREETS_SOUTH;
    const [street, postalCode, latitude, longitude] = streets[inZone % streets.length]!;
    const type = DEMO_MERCHANT_TYPES[index % DEMO_MERCHANT_TYPES.length]!;
    const name = `${type.label} ${DEMO_MERCHANT_WORDS[Math.floor(index / DEMO_MERCHANT_TYPES.length)]}`;
    const firstName = DEMO_FIRST_NAMES[index % DEMO_FIRST_NAMES.length]!;
    const lastName = DEMO_LAST_NAMES[(index * 7) % DEMO_LAST_NAMES.length]!;
    const merchantId = id("merchant", pad(index + 1, 3));
    const email = `${slugify(name)}.${pad(slot)}@${DEMO_EMAIL_DOMAIN}`;
    const lat = Math.round((latitude + (random() - 0.5) * 0.0024) * 1e6) / 1e6;
    const lng = Math.round((longitude + (random() - 0.5) * 0.0034) * 1e6) / 1e6;

    // Produits habituels : surtout la première catégorie du type de client.
    const usual: Array<readonly [number, number]> = [];
    const shares = [8, 5, 4, 3];
    for (const [rank, category] of type.categories.entries()) {
      const pool = [...(categoryProducts.get(category) ?? [])];
      for (let pick = 0; pick < shares[rank]! && pool.length; pick += 1) {
        const [productIndex] = pool.splice(Math.floor(random() * pool.length), 1);
        const range = DEMO_QUANTITY_RANGES[category] ?? [2, 10];
        const boost = type.label === "Hôtel" && category === "viennoiseries" ? 1.5 : 1;
        usual.push([productIndex!, Math.max(1, Math.round(between(random, range) * boost))]);
      }
    }

    merchants.push({
      ...base,
      id: merchantId,
      name,
      address: `${1 + Math.floor(random() * 120)} ${street}`,
      postalCode,
      city: "Paris",
      latitude: lat,
      longitude: lng,
      accessInstructions: DEMO_ACCESS_INSTRUCTIONS[index % DEMO_ACCESS_INSTRUCTIONS.length]!,
      contactName: `${firstName} ${lastName}`,
      contactPhone: `06${pad(10 + (index % 90))}${pad(slot)}${pad(index % 100)}${pad((index * 13) % 100)}`,
      contactEmail: email,
      billingEmail: email,
      billingPeriod: billing[index % billing.length]!,
      paymentMethod: payment[index % payment.length]!,
      active: true,
      zoneId: zoneId(zone),
    });
    plans.push({ id: merchantId, index, zone, period, latitude: lat, longitude: lng, usual });

    // Prix spécifiques (RG-05) : un client sur neuf, 10 % sous le prix de base sur trois produits habituels.
    if (index % 9 === 0) {
      for (const [productIndex] of usual.slice(0, 3)) {
        merchantPrices.push({
          ...base,
          id: id("price", pad(index + 1, 3), productIndex),
          merchantId,
          productId: productId(productIndex),
          priceCents: Math.round(Number(products[productIndex]!.basePriceCents) * 0.9),
        });
      }
    }
  }
  const unitPrice = new Map<string, number>(products.map((product) => [product.id!, Number(product.basePriceCents)]));
  for (const price of merchantPrices) unitPrice.set(`${price.merchantId}:${price.productId}`, price.priceCents);
  const priceFor = (merchantId: string, product: string) => unitPrice.get(`${merchantId}:${product}`) ?? unitPrice.get(product)!;

  // Comptes : un par rôle à essayer, plus trois livreurs (un par tournée). Le client de démo est le premier client du matin Nord.
  const clientPlan = plans[0]!;
  const clientMerchant = merchants[0]!;
  const [clientFirst, clientLast] = String(clientMerchant.contactName).split(" ") as [string, string];
  const email = (who: string) => `demo-${pad(slot)}-${who}@${DEMO_EMAIL_DOMAIN}`;
  const users: DemoScenarioUser[] = [
    { id: id("user", "admin"), persona: "admin", email: email("admin"), firstName: "Camille", lastName: "Durand", phone: "0601020304", role: "ADMIN", merchantId: null },
    { id: id("user", "baker"), persona: "baker", email: email("boulanger"), firstName: "Bastien", lastName: "Fournier", phone: "0601020305", role: "BAKER", merchantId: null },
    { id: id("user", "driver"), persona: "driver", email: email("livreur"), firstName: "Mathis", lastName: "Moreau", phone: "0611000001", role: "DRIVER", merchantId: null },
    { id: id("user", "driver2"), persona: null, email: email("livreur-2"), firstName: "Lina", lastName: "Garcia", phone: "0611000002", role: "DRIVER", merchantId: null },
    { id: id("user", "client"), persona: "client", email: email("client"), firstName: clientFirst, lastName: clientLast, phone: String(clientMerchant.contactPhone), role: "MERCHANT", merchantId: clientPlan.id },
    { id: id("user", "driver3"), persona: null, email: email("livreur-3"), firstName: "Yanis", lastName: "Petit", phone: "0611000003", role: "DRIVER", merchantId: null },
    { id: id("user", "driver4"), persona: null, email: email("livreur-4"), firstName: "Inès", lastName: "Robert", phone: "0611000004", role: "DRIVER", merchantId: null },
    { id: id("user", "pastry"), persona: "pastry", email: email("patissier"), firstName: "Margot", lastName: "Lemoine", phone: "0601020306", role: "PASTRY_CHEF", merchantId: null },
  ];

  // Boutiques de l'entreprise (LOT2-D1) : un compte vente chacune, celui de la première est le compte de démo.
  const shopPlans: MerchantPlan[] = [];
  const sellers = [
    { persona: "seller" as const, who: "vente", firstName: "Jade", lastName: "Morel", phone: "0622000001" },
    { persona: null, who: "vente-2", firstName: "Sarah", lastName: "Chevalier", phone: "0622000002" },
  ];
  for (const [index, shop] of DEMO_SHOPS.entries()) {
    const merchantId = id("shop", shop.key);
    const seller = sellers[index]!;
    const sellerId = id("user", seller.persona ?? `seller_${shop.key}`);
    const [street, postalCode, latitude, longitude] = shop.street;
    merchants.push({
      ...base,
      id: merchantId,
      kind: "SHOP",
      name: shop.name,
      address: `${shop.number} ${street}`,
      postalCode,
      city: "Paris",
      latitude,
      longitude,
      accessInstructions: shop.access,
      contactName: `${seller.firstName} ${seller.lastName}`,
      contactPhone: seller.phone,
      contactEmail: `${shop.key}.${pad(slot)}@${DEMO_EMAIL_DOMAIN}`,
      active: true,
      zoneId: zoneId(shop.zone),
    });
    users.push({ id: sellerId, persona: seller.persona, email: email(seller.who), firstName: seller.firstName, lastName: seller.lastName, phone: seller.phone, role: "SELLER", merchantId });
    shopPlans.push({ id: merchantId, index: -1 - index, zone: shop.zone, period: "matin", latitude, longitude, usual: [], shop: { index, key: shop.key, sellerId } });
  }
  const pastryUserId = id("user", "pastry");
  const assortment = DEMO_SHOP_ASSORTMENT.map(([name, min, max]) => {
    const productIndex = productIndexByName.get(name);
    if (productIndex === undefined) throw new Error(`Produit de l'assortiment des points de vente absent du catalogue : ${name}`);
    return [productIndex, min, max] as const;
  });

  // Prix boutique TTC (LOT2-D4) : chaque produit vendu dans chaque boutique, gros gâteaux par taille.
  const shopPrices: Prisma.ShopPriceCreateManyInput[] = [];
  const retailCents = (wholesaleCents: number) => Math.max(50, Math.round((wholesaleCents * 2.2) / 10) * 10);
  const cakeRetailCents = (restaurantCents: number) => Math.round((restaurantCents * 1.8) / 100) * 100;
  const sizeRetail = new Map<string, number>();
  for (const shop of shopPlans) {
    for (const product of products) {
      if (product.pastryFormat === "LARGE") continue;
      shopPrices.push({ ...base, id: id("shopprice", shop.shop!.key, slugify(product.name)), shopId: shop.id, productId: product.id!, sold: true, priceCents: retailCents(Number(product.basePriceCents)) });
    }
    for (const cake of largeCakes) {
      for (const size of cake.sizes) {
        const priceCents = cakeRetailCents(size.restaurantPriceCents);
        sizeRetail.set(size.id, priceCents);
        shopPrices.push({ ...base, id: id("shopprice", shop.shop!.key, size.id.slice(prefix.length)), shopId: shop.id, productId: cake.productId, sizeId: size.id, sizeKey: size.id, sold: true, priceCents });
      }
    }
  }

  // Commandes de gâteaux des particuliers (LOT2-D9) : soldées les jours passés, à retirer aujourd'hui et demain.
  // Chacune part dans l'envoi du matin du jour du retrait (ligne réservée, `cakeOrderId`).
  const cakeOrders: Prisma.CakeOrderCreateManyInput[] = [];
  const cakesByShipment = new Map<string, Prisma.CakeOrderCreateManyInput[]>();
  const cakeOffsets = [-6, -4, -2, 0, 0, 1, 1] as const;
  const pickupMinutes = [10 * 60 + 30, 12 * 60, 16 * 60, 17 * 60 + 30] as const;
  for (const shop of shopPlans) {
    const shopIndex = shop.shop!.index;
    for (const [k, pickupOffset] of cakeOffsets.entries()) {
      const [customerName, customerPhone, inscription, note] = DEMO_CAKE_CUSTOMERS[(shopIndex * 3 + k) % DEMO_CAKE_CUSTOMERS.length]!;
      const cake = largeCakes[(k + shopIndex) % largeCakes.length]!;
      const size = cake.sizes[k % cake.sizes.length]!;
      const priceCents = sizeRetail.get(size.id)!;
      const payment = k % 2 === 0 ? ("FULL" as const) : ("DEPOSIT" as const);
      const pickupDay = addCalendarDays(today, pickupOffset);
      const pickupAt = dayClock(pickupDay)(pickupMinutes[k % pickupMinutes.length]!);
      const cakeOrder: Prisma.CakeOrderCreateManyInput = {
        ...base,
        id: id("cake", shop.shop!.key, k + 1),
        shopId: shop.id,
        productId: cake.productId,
        sizeId: size.id,
        inscription,
        note,
        servings: size.servings,
        priceCents,
        payment,
        // Acompte : la moitié au moins, arrondie à l'euro supérieur (LOT2-D9).
        paidCents: payment === "FULL" ? priceCents : Math.ceil(priceCents / 200) * 100,
        customerName,
        customerPhone,
        pickupAt,
        pickupDate: dbDate(pickupDay),
        status: pickupOffset < 0 ? "SETTLED" : "ORDERED",
        settledAt: pickupOffset < 0 ? pickupAt : null,
        createdById: shop.shop!.sellerId,
        // Au moins 48 h avant le retrait (LOT2-D9).
        createdAt: dayClock(addCalendarDays(pickupDay, -3 - (k % 3)))(11 * 60 + k * 17),
      };
      cakeOrders.push(cakeOrder);
      const shipmentKey = `${shop.id}|${dayKey(pickupDay)}`;
      cakesByShipment.set(shipmentKey, [...(cakesByShipment.get(shipmentKey) ?? []), cakeOrder]);
    }
  }
  // Un livreur par tournée : les quatre tournées du jour roulent en même temps. Le livreur de démo fait le soir Nord.
  const driverFor = (zone: ZoneKey, period: PeriodKey) =>
    zone === "nord" ? (period === "soir" ? users[2]!.id : users[5]!.id) : period === "soir" ? users[3]!.id : users[6]!.id;

  // Commande récurrente : le deuxième client du matin Nord, du lundi au samedi.
  const recurringPlan = plans[1]!;
  const recurringId = id("recurring", pad(recurringPlan.index + 1, 3));
  const recurringOrders: Prisma.RecurringOrderCreateManyInput[] = [
    { ...base, id: recurringId, merchantId: recurringPlan.id, slotId: slotId("nord", "matin"), label: "Commande de la semaine", weekdays: [1, 2, 3, 4, 5, 6], active: true },
  ];
  const recurringOrderLines: Prisma.RecurringOrderLineCreateManyInput[] = recurringPlan.usual.slice(0, 16).map(([productIndex, quantity]) => ({
    ...base,
    recurringOrderId: recurringId,
    productId: productId(productIndex),
    quantity,
  }));

  const orders: Prisma.OrderCreateManyInput[] = [];
  const orderLines: Prisma.OrderLineCreateManyInput[] = [];
  const rounds: Prisma.RoundCreateManyInput[] = [];
  const stops: Prisma.StopCreateManyInput[] = [];
  const adminId = users[0]!.id;
  const clientUserId = users[4]!.id;
  // Stock des boutiques, lot par lot (LOT2-D6 à D8), rejoué jour après jour avec les règles de la tablette.
  const shopLots = shopPlans.map(() => new Map<number, Array<StockLot & { initialQuantity: number }>>());
  const shopDayCloses: Prisma.ShopDayCloseCreateManyInput[] = [];

  for (let offset = -DEMO_SCENARIO.historyDays; offset <= 1; offset += 1) {
    const day = addCalendarDays(today, offset);
    const at = dayClock(day);
    const previous = dayClock(addCalendarDays(day, -1));
    const daily = prng(Number(dayKey(day)) * 31 + slot);
    const sunday = isoWeekday(day) === 7;
    // Le lendemain avant l'heure limite : seuls certains clients ont déjà commandé (le client de démo non).
    const tomorrowOpen = offset === 1 && clockNow < DEMO_SCENARIO.cutoff;
    const shopReceipts: Array<{ shopIndex: number; productIndex: number; good: number; damaged: number }> = [];

    for (const zone of ["nord", "sud"] as const) {
      for (const period of ["matin", "soir"] as const) {
        if (sunday && period === "soir") continue;
        const group = plans.filter((plan) => plan.zone === zone && plan.period === period);
        const skippedRange = period === "matin" ? DEMO_SCENARIO.morningSkipped : DEMO_SCENARIO.eveningSkipped;
        const skipCount = sunday ? Math.floor(group.length / 2) : between(daily, skippedRange);
        const skipped = new Set<string>();
        const candidates = group.filter((plan) => plan !== clientPlan && plan !== recurringPlan);
        while (skipped.size < skipCount && skipped.size < candidates.length) {
          skipped.add(candidates[Math.floor(daily() * candidates.length)]!.id);
        }
        // Tirages faits pour chaque client quelle que soit l'heure : la journée ne dépend que de (environnement, jour).
        const ordering = group.filter((plan) => {
          const orderedEarly = daily() <= 0.7;
          if (skipped.has(plan.id)) return false;
          if (offset === 1 && plan === clientPlan) return false;
          if (tomorrowOpen && plan !== recurringPlan && !orderedEarly) return false;
          return true;
        });
        // Les boutiques reçoivent leur envoi tous les matins, sur la tournée de leur zone (LOT2-D5).
        if (period === "matin") ordering.push(...shopPlans.filter((plan) => plan.zone === zone));
        if (!ordering.length) continue;

        const phase = slotPhase(offset, zone, period, clockNow);
        const window = phase.window;
        const sequence = demoRoundOrder(ordering);
        const span = window.end - window.start - 20;
        const roundId = id("round", dayKey(day), zone, period);
        const withRound = !tomorrowOpen;
        const roundStatus: RoundStatus = phase.round;
        let lastDelivered: number | null = null;

        sequence.forEach((plan, position) => {
          const eta = window.start + 10 + Math.round((span * position) / Math.max(1, sequence.length - 1));
          if (plan.shop) {
            // Envoi du laboratoire vers la boutique (LOT2-D5) : tirages à part, la journée des clients ne change pas.
            const shop = plan.shop;
            const shopRandom = prng(Number(dayKey(day)) * 97 + slot * 13 + shop.index + 1);
            const shipmentId = id("order", dayKey(day), "shop", shop.key);
            const delivered = phase.deliveredUntil !== null && eta <= phase.deliveredUntil;
            const deliveredMinute = delivered ? Math.min(eta + Math.floor(shopRandom() * 7) - 2, phase.deliveredUntil!) : null;
            if (deliveredMinute !== null) lastDelivered = deliveredMinute;
            // Les jours passés, la vendeuse a noté la réception ; aujourd'hui, elle reste à faire sur la tablette (LOT2-D6).
            const received = offset < 0;
            const decidedAt = offset === 1 ? at(-24 * 60 + Math.min(10 * 60, clockNow - 1)) : previous(10 * 60);
            for (const [productIndex, min, max] of assortment) {
              const sent = between(shopRandom, [min, max]);
              const missing = received && shopRandom() < 0.04 ? 1 : 0;
              const damaged = received && shopRandom() < 0.05 ? 1 : 0;
              orderLines.push({
                ...base,
                orderId: shipmentId,
                productId: productId(productIndex),
                quantityOrdered: sent,
                quantityDelivered: delivered ? sent : null,
                quantityReceived: received ? sent - missing : null,
                quantityDamaged: received ? damaged : null,
              });
              if (received) shopReceipts.push({ shopIndex: shop.index, productIndex, good: sent - missing - damaged, damaged });
            }
            for (const cake of cakesByShipment.get(`${plan.id}|${dayKey(day)}`) ?? []) {
              orderLines.push({
                ...base,
                orderId: shipmentId,
                productId: cake.productId,
                quantityOrdered: 1,
                quantityDelivered: delivered ? 1 : null,
                sizeId: cake.sizeId,
                inscription: cake.inscription,
                note: cake.note,
                cakeOrderId: cake.id,
                variantKey: `cake:${cake.id}`,
              });
            }
            orders.push({
              ...base,
              id: shipmentId,
              reference: `E${dayKey(day)}-${pad(shop.index + 1)}`,
              merchantId: plan.id,
              deliveryDate: dbDate(day),
              slotId: slotId(zone, period),
              status: delivered ? "DELIVERED" : phase.prepared ? "PREPARED" : "LOCKED",
              origin: "SHIPMENT",
              createdById: pastryUserId,
              validatedAt: decidedAt,
              lockedAt: decidedAt,
              preparedAt: phase.prepared ? at(phase.preparedAt) : null,
              deliveredAt: deliveredMinute !== null ? at(deliveredMinute) : null,
              receivedAt: received ? at((deliveredMinute ?? eta) + 20) : null,
            });
            if (withRound) {
              stops.push({
                ...base,
                id: id("stop", dayKey(day), "shop", shop.key),
                roundId,
                orderId: shipmentId,
                sequence: position + 1,
                status: delivered ? "DELIVERED" : "PENDING",
                estimatedArrivalAt: at(eta),
                deliveredAt: deliveredMinute !== null ? at(deliveredMinute) : null,
              });
            }
            return;
          }
          const orderId = id("order", dayKey(day), pad(plan.index + 1, 3), period);
          const jitter = Math.floor(daily() * 9) - 3;
          const delivered = phase.deliveredUntil !== null && eta <= phase.deliveredUntil;
          const deliveredMinute = delivered ? Math.min(eta + jitter, phase.deliveredUntil!) : null;
          if (deliveredMinute !== null) lastDelivered = deliveredMinute;
          const locked = offset <= 0 || !tomorrowOpen;
          const status: OrderStatus = delivered ? "DELIVERED" : phase.prepared ? "PREPARED" : locked ? "LOCKED" : "VALIDATED";
          const recurring = plan === recurringPlan && isoWeekday(day) <= 6;
          const validatedMinute = 8 * 60 + Math.floor(daily() * 8 * 60);
          const validatedAt = offset === 1 ? at(-24 * 60 + Math.min(validatedMinute, clockNow - 1)) : previous(validatedMinute);

          const lineCount = Math.min(plan.usual.length, between(daily, DEMO_SCENARIO.linesPerOrder as readonly [number, number]));
          const chosen = [...plan.usual].sort(() => daily() - 0.5).slice(0, lineCount);
          for (const [productIndex, quantity] of chosen) {
            const product = productId(productIndex);
            const ordered = Math.max(1, Math.round(quantity * (0.75 + daily() * 0.5)));
            // Un manquant de temps en temps (BOU-06) : la facture porte sur la quantité livrée.
            const shortRoll = daily();
            const shortQuantity = 1 + Math.floor(daily() * 3);
            const shortage = delivered && shortRoll < 0.03 ? Math.min(ordered, shortQuantity) : 0;
            orderLines.push({
              ...base,
              orderId,
              productId: product,
              quantityOrdered: ordered,
              quantityDelivered: delivered ? ordered - shortage : null,
              unitPriceFrozenCents: locked ? priceFor(plan.id, product) : null,
            });
          }

          orders.push({
            ...base,
            id: orderId,
            reference: `D${dayKey(day)}-${pad(plan.index + 1, 3)}${period === "matin" ? "M" : "S"}`,
            merchantId: plan.id,
            deliveryDate: dbDate(day),
            slotId: slotId(zone, period),
            status,
            origin: recurring ? "RECURRING" : "MANUAL",
            recurringOrderId: recurring ? recurringId : null,
            createdById: recurring ? null : plan === clientPlan ? clientUserId : adminId,
            validatedAt,
            lockedAt: locked ? previous(DEMO_SCENARIO.cutoff) : null,
            preparedAt: phase.prepared ? at(phase.preparedAt) : null,
            deliveredAt: deliveredMinute !== null ? at(deliveredMinute) : null,
          });

          if (withRound) {
            const stopStatus: StopStatus = delivered ? "DELIVERED" : "PENDING";
            stops.push({
              ...base,
              id: id("stop", dayKey(day), pad(plan.index + 1, 3), period),
              roundId,
              orderId,
              sequence: position + 1,
              status: stopStatus,
              estimatedArrivalAt: at(eta),
              deliveredAt: deliveredMinute !== null ? at(deliveredMinute) : null,
            });
          }
        });

        if (withRound) {
          rounds.push({
            ...base,
            id: roundId,
            date: dbDate(day),
            slotId: slotId(zone, period),
            driverId: driverFor(zone, period),
            name: `Tournée ${zone === "nord" ? "Nord" : "Sud"} ${period}`,
            status: roundStatus,
            startedAt: roundStatus === "IN_PROGRESS" || roundStatus === "COMPLETED" ? at(window.start) : null,
            completedAt: roundStatus === "COMPLETED" ? at(lastDelivered ?? window.end) : null,
          });
        }
      }
    }

    // Jours passés : le bon état reçu entre en stock, puis la clôture du soir (ventes calculées, fin de vente jetée).
    if (offset < 0) {
      const date = isoDay(day);
      for (const shop of shopPlans) {
        const { index: shopIndex, key, sellerId } = shop.shop!;
        const lots = shopLots[shopIndex]!;
        const damagedOnDelivery = new Map<number, number>();
        for (const receipt of shopReceipts.filter((row) => row.shopIndex === shopIndex)) {
          damagedOnDelivery.set(receipt.productIndex, receipt.damaged);
          if (receipt.good <= 0) continue;
          const shelfLife = Number(products[receipt.productIndex]!.shelfLifeDays ?? 1);
          const lot = { id: id("lot", key, dayKey(day), receipt.productIndex), receivedOn: date, lastSaleDay: lastSaleDayOf(date, shelfLife), quantity: receipt.good, initialQuantity: receipt.good };
          lots.set(receipt.productIndex, [...(lots.get(receipt.productIndex) ?? []), lot]);
        }
        const closeRandom = prng(Number(dayKey(day)) * 131 + slot * 17 + shopIndex + 1);
        for (const [productIndex, productLots] of [...lots].sort(([a], [b]) => a - b)) {
          const available = productLots.reduce((sum, lot) => sum + lot.quantity, 0);
          if (available === 0) continue;
          const remaining = Math.round(available * (0.04 + closeRandom() * 0.16));
          const damaged = remaining > 0 && closeRandom() < 0.04 ? 1 : 0;
          const plan = planClose(date, productLots, { remaining, damaged });
          for (const lot of productLots) lot.quantity = plan.lotsAfter.get(lot.id) ?? lot.quantity;
          shopDayCloses.push({
            ...base,
            id: id("close", key, dayKey(day), productIndex),
            shopId: shop.id,
            productId: productId(productIndex),
            date: dbDate(day),
            morningStock: plan.morningStock,
            receivedGood: plan.receivedGood,
            receivedDamaged: damagedOnDelivery.get(productIndex) ?? 0,
            remaining,
            sold: plan.sold,
            discardedExpired: plan.discardedExpired,
            discardedDamaged: plan.discardedDamaged,
            closedById: sellerId,
            createdAt: at(19 * 60 + 30),
          });
        }
      }
    }
  }

  const isoDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
  const shopStockLots: Prisma.ShopStockLotCreateManyInput[] = shopPlans.flatMap((shop) =>
    [...shopLots[shop.shop!.index]!].flatMap(([productIndex, lots]) =>
      lots.map((lot) => ({
        ...base,
        id: lot.id,
        shopId: shop.id,
        productId: productId(productIndex),
        receivedOn: isoDate(lot.receivedOn),
        lastSaleDay: isoDate(lot.lastSaleDay),
        initialQuantity: lot.initialQuantity,
        quantity: lot.quantity,
      }))
    )
  );

  const company: Prisma.CompanyCreateManyInput = {
    id: companyId,
    slug: `demo-pool-${pad(slot)}`,
    name: "Entreprise de démonstration",
    email: `contact-demo-${pad(slot)}@${DEMO_EMAIL_DOMAIN}`,
    phone: "0140000000",
    address: DEMO_SCENARIO.depot.address,
    city: "Paris",
    country: "FR",
    status: "ACTIVE",
    cutoffTime: hhmm(DEMO_SCENARIO.cutoff),
    timezone: "Europe/Paris",
    reminderLeadMinutes: 120,
    legalName: "Entreprise de démonstration SAS",
    billingAddress: DEMO_SCENARIO.depot.address,
    billingPostalCode: DEMO_SCENARIO.depot.postalCode,
    billingCity: "Paris",
    depotLatitude: DEMO_SCENARIO.depot.latitude,
    depotLongitude: DEMO_SCENARIO.depot.longitude,
    settings: {
      demo: true,
      units: ["pièce", "part", "kg", "sachet de 6", "sachet de 10", "sachet de 20", "boîte de 6", "plaque", "plaque de 20"],
      billing: { invoice: { footerNote: "Données de démonstration : aucune facture réelle." } },
    },
  };

  return {
    slot,
    prefix,
    companyId,
    day: isoDay(today),
    company,
    categories,
    products,
    productSizes,
    zones,
    slots,
    merchants,
    merchantPrices,
    shopPrices,
    users,
    recurringOrders,
    recurringOrderLines,
    cakeOrders,
    orders,
    orderLines,
    rounds,
    stops,
    shopStockLots,
    shopDayCloses,
  };
}
