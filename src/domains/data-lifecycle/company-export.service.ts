import { Prisma, type AuditLog, type Category, type DeliveryZone, type Product, type Slot } from "@prisma/client";
import { prisma } from "@/services/prisma/client";

/**
 * Export portable du périmètre d'une entreprise.
 *
 * Les identifiants relationnels sont conservés pour permettre une reprise, mais
 * les identifiants Supabase Auth, clés d'idempotence, empreintes de requête,
 * charges de jobs et erreurs internes sont exclus.
 * Version 2 (SCHEMA-1) : modèle boulangerie (commerçants, catalogue, commandes, tournées, factures de période).
 *
 * Les collections sont relues par pages (clé `createdAt`, `id`) dans une seule
 * transaction en lecture répétable : l'instantané reste cohérent et la mémoire
 * est bornée par une page, pas par la taille de l'entreprise.
 */
export const COMPANY_EXPORT_PAGE_SIZE = 100;
const COMPANY_EXPORT_PAGE_SIZE_MAX = 1_000;
// Un export en flux d'une grosse entreprise dépasse la minute ; la lecture reste unique et cohérente.
const COMPANY_EXPORT_TIMEOUT_MS = 10 * 60_000;

const COMPANY_SELECT = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  country: true,
  status: true,
  settings: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanySelect;

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatarUrl: true,
  settings: true,
  status: true,
  merchantId: true,
  role: { select: { name: true, slug: true, systemRole: true } },
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  driverLocation: { select: { latitude: true, longitude: true, accuracy: true, updatedAt: true } },
  notifications: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  },
} satisfies Prisma.UserSelect;

const MERCHANT_INCLUDE = {
  prices: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.MerchantInclude;

/** Lot 1, demande 2 : promotions et clients choisis. */
const PROMOTION_INCLUDE = {
  merchants: { orderBy: { merchantId: "asc" } },
} satisfies Prisma.PromotionInclude;

const RECURRING_ORDER_INCLUDE = {
  lines: { orderBy: { id: "asc" } },
} satisfies Prisma.RecurringOrderInclude;

const ORDER_INCLUDE = {
  lines: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  stop: true,
} satisfies Prisma.OrderInclude;

const ROUND_INCLUDE = {
  stops: { orderBy: [{ sequence: "asc" }, { id: "asc" }] },
} satisfies Prisma.RoundInclude;

const INVOICE_INCLUDE = {
  lines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
  payments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.InvoiceInclude;

const SUPPORT_TICKET_INCLUDE = {
  messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.SupportTicketInclude;

const OPERATION_JOB_SELECT = {
  id: true,
  jobKey: true,
  type: true,
  status: true,
  attempts: true,
  maxAttempts: true,
  nextAttemptAt: true,
  lockedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OperationJobSelect;

export type ExportedCompany = Prisma.CompanyGetPayload<{ select: typeof COMPANY_SELECT }>;

/** Collections dans l'ordre d'écriture : référentiel, commandes, tournées, factures, échanges. */
export interface CompanyExportRows {
  users: Prisma.UserGetPayload<{ select: typeof USER_SELECT }>[];
  merchants: Prisma.MerchantGetPayload<{ include: typeof MERCHANT_INCLUDE }>[];
  categories: Category[];
  products: Product[];
  /** Lot 1, demande 2 : promotions (les lignes de commande portent leur part promo). */
  promotions: Prisma.PromotionGetPayload<{ include: typeof PROMOTION_INCLUDE }>[];
  /** Lot 1, demande 1 : tournées (zone, plage du matin, plage du soir). */
  deliveryZones: DeliveryZone[];
  slots: Slot[];
  recurringOrders: Prisma.RecurringOrderGetPayload<{ include: typeof RECURRING_ORDER_INCLUDE }>[];
  orders: Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>[];
  rounds: Prisma.RoundGetPayload<{ include: typeof ROUND_INCLUDE }>[];
  invoices: Prisma.InvoiceGetPayload<{ include: typeof INVOICE_INCLUDE }>[];
  supportTickets: Prisma.SupportTicketGetPayload<{ include: typeof SUPPORT_TICKET_INCLUDE }>[];
  auditLogs: AuditLog[];
  operationJobs: Prisma.OperationJobGetPayload<{ select: typeof OPERATION_JOB_SELECT }>[];
}

export type CompanyExportCollection = keyof CompanyExportRows;

export interface CompanyExportHeader {
  schema: "annona-company-export";
  version: 2;
  exportedAt: string;
}

/** Photo d'incident d'un arrêt, stockée dans le bucket privé. */
export interface CompanyExportProofObject {
  stopId: string;
  orderId: string;
  objectKey: string;
}

export interface CompanyExportSummary extends CompanyExportHeader {
  counts: Record<
    | "users" | "notifications" | "merchants" | "merchantPrices" | "categories" | "products" | "promotions" | "deliveryZones" | "slots"
    | "recurringOrders" | "orders" | "orderLines" | "rounds" | "stops" | "invoices" | "invoiceLines" | "payments"
    | "supportTickets" | "supportMessages" | "auditLogs" | "operationJobs" | "proofObjects",
    number
  >;
  externalAssets: { proofObjects: CompanyExportProofObject[]; note: string };
}

/**
 * Reçoit l'entreprise puis chaque page, collection par collection, dans l'ordre de
 * `data` ; chaque collection reçoit au moins une page, éventuellement vide.
 */
export interface CompanyExportVisitor {
  start(header: CompanyExportHeader, company: ExportedCompany): Promise<void>;
  page<C extends CompanyExportCollection>(collection: C, rows: CompanyExportRows[C]): Promise<void>;
}

type Keyset = { createdAt: Date; id: string };

function pageWhere(companyId: string, after: Keyset | null) {
  return after
    ? { companyId, OR: [{ createdAt: { gt: after.createdAt } }, { createdAt: after.createdAt, id: { gt: after.id } }] }
    : { companyId };
}

async function forEachPage<T extends Keyset>(
  pageSize: number,
  read: (after: Keyset | null) => Promise<T[]>,
  handle: (rows: T[]) => Promise<void>
) {
  let after: Keyset | null = null;
  for (;;) {
    const rows = await read(after);
    if (rows.length || after === null) await handle(rows);
    if (rows.length < pageSize) return;
    after = rows[rows.length - 1]!;
  }
}

export async function visitCompanyExport(
  companyId: string,
  visitor: CompanyExportVisitor,
  options: { pageSize?: number } = {}
): Promise<CompanyExportSummary | null> {
  const pageSize = options.pageSize ?? COMPANY_EXPORT_PAGE_SIZE;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > COMPANY_EXPORT_PAGE_SIZE_MAX) {
    throw new Error("EXPORT_INVALID_PAGE_SIZE");
  }
  const header: CompanyExportHeader = {
    schema: "annona-company-export",
    version: 2,
    exportedAt: new Date().toISOString(),
  };
  const counts: CompanyExportSummary["counts"] = {
    users: 0, notifications: 0, merchants: 0, merchantPrices: 0, categories: 0, products: 0, promotions: 0, deliveryZones: 0, slots: 0,
    recurringOrders: 0, orders: 0, orderLines: 0, rounds: 0, stops: 0, invoices: 0, invoiceLines: 0, payments: 0,
    supportTickets: 0, supportMessages: 0, auditLogs: 0, operationJobs: 0, proofObjects: 0,
  };
  const proofObjects: CompanyExportProofObject[] = [];
  const page = { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }], take: pageSize };

  const found = await prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({ where: { id: companyId }, select: COMPANY_SELECT });
    if (!company) return false;
    await visitor.start(header, company);

    await forEachPage(pageSize, (after) => tx.user.findMany({ where: pageWhere(companyId, after), ...page, select: USER_SELECT }),
      async (rows) => {
        counts.users += rows.length;
        for (const user of rows) counts.notifications += user.notifications.length;
        await visitor.page("users", rows);
      });
    await forEachPage(pageSize, (after) => tx.merchant.findMany({ where: pageWhere(companyId, after), ...page, include: MERCHANT_INCLUDE }),
      async (rows) => {
        counts.merchants += rows.length;
        for (const merchant of rows) counts.merchantPrices += merchant.prices.length;
        await visitor.page("merchants", rows);
      });
    await forEachPage(pageSize, (after) => tx.category.findMany({ where: pageWhere(companyId, after), ...page }),
      async (rows) => { counts.categories += rows.length; await visitor.page("categories", rows); });
    await forEachPage(pageSize, (after) => tx.product.findMany({ where: pageWhere(companyId, after), ...page }),
      async (rows) => { counts.products += rows.length; await visitor.page("products", rows); });
    await forEachPage(pageSize, (after) => tx.promotion.findMany({ where: pageWhere(companyId, after), ...page, include: PROMOTION_INCLUDE }),
      async (rows) => { counts.promotions += rows.length; await visitor.page("promotions", rows); });
    await forEachPage(pageSize, (after) => tx.deliveryZone.findMany({ where: pageWhere(companyId, after), ...page }),
      async (rows) => { counts.deliveryZones += rows.length; await visitor.page("deliveryZones", rows); });
    await forEachPage(pageSize, (after) => tx.slot.findMany({ where: pageWhere(companyId, after), ...page }),
      async (rows) => { counts.slots += rows.length; await visitor.page("slots", rows); });
    await forEachPage(pageSize, (after) => tx.recurringOrder.findMany({ where: pageWhere(companyId, after), ...page, include: RECURRING_ORDER_INCLUDE }),
      async (rows) => { counts.recurringOrders += rows.length; await visitor.page("recurringOrders", rows); });
    await forEachPage(pageSize, (after) => tx.order.findMany({ where: pageWhere(companyId, after), ...page, include: ORDER_INCLUDE }),
      async (rows) => {
        counts.orders += rows.length;
        for (const order of rows) counts.orderLines += order.lines.length;
        await visitor.page("orders", rows);
      });
    await forEachPage(pageSize, (after) => tx.round.findMany({ where: pageWhere(companyId, after), ...page, include: ROUND_INCLUDE }),
      async (rows) => {
        counts.rounds += rows.length;
        for (const round of rows) {
          counts.stops += round.stops.length;
          for (const stop of round.stops) {
            if (stop.incidentPhotoPath) proofObjects.push({ stopId: stop.id, orderId: stop.orderId, objectKey: stop.incidentPhotoPath });
          }
        }
        await visitor.page("rounds", rows);
      });
    await forEachPage(pageSize, (after) => tx.invoice.findMany({ where: pageWhere(companyId, after), ...page, include: INVOICE_INCLUDE }),
      async (rows) => {
        counts.invoices += rows.length;
        for (const invoice of rows) {
          counts.invoiceLines += invoice.lines.length;
          counts.payments += invoice.payments.length;
        }
        await visitor.page("invoices", rows);
      });
    await forEachPage(pageSize, (after) => tx.supportTicket.findMany({ where: pageWhere(companyId, after), ...page, include: SUPPORT_TICKET_INCLUDE }),
      async (rows) => {
        counts.supportTickets += rows.length;
        for (const ticket of rows) counts.supportMessages += ticket.messages.length;
        await visitor.page("supportTickets", rows);
      });
    await forEachPage(pageSize, (after) => tx.auditLog.findMany({ where: pageWhere(companyId, after), ...page }),
      async (rows) => { counts.auditLogs += rows.length; await visitor.page("auditLogs", rows); });
    await forEachPage(pageSize, (after) => tx.operationJob.findMany({ where: pageWhere(companyId, after), ...page, select: OPERATION_JOB_SELECT }),
      async (rows) => { counts.operationJobs += rows.length; await visitor.page("operationJobs", rows); });
    return true;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    maxWait: 10_000,
    timeout: COMPANY_EXPORT_TIMEOUT_MS,
  });

  if (!found) return null;
  counts.proofObjects = proofObjects.length;
  return {
    ...header,
    counts,
    externalAssets: {
      proofObjects,
      note: "Les photos d'incident doivent être exportées séparément depuis le bucket privé.",
    },
  };
}

/** Export complet en mémoire, pour les recettes et les petites entreprises. */
export async function exportCompanyData(companyId: string, options: { pageSize?: number } = {}) {
  let company: ExportedCompany | null = null;
  const data: CompanyExportRows = {
    users: [],
    merchants: [],
    categories: [],
    products: [],
    promotions: [],
    deliveryZones: [],
    slots: [],
    recurringOrders: [],
    orders: [],
    rounds: [],
    invoices: [],
    supportTickets: [],
    auditLogs: [],
    operationJobs: [],
  };
  const summary = await visitCompanyExport(companyId, {
    async start(_header, exported) {
      company = exported;
    },
    async page(collection, rows) {
      (data[collection] as unknown[]).push(...rows);
    },
  }, options);
  if (!summary || !company) return null;
  const { counts, externalAssets, ...header } = summary;
  return { ...header, counts, externalAssets, data: { company: company as ExportedCompany, ...data } };
}

/**
 * Sérialise l'export au fil des pages, dans le même document v2 que `exportCompanyData`
 * (`counts` et `externalAssets` sont écrits après `data`, une fois connus).
 */
export function createCompanyExportJsonWriter(write: (text: string) => Promise<void>) {
  const done = new Set<CompanyExportCollection>();
  let current: CompanyExportCollection | null = null;
  let items = 0;
  const closeCollection = () => (current === null ? "" : items ? "\n    ]" : "]");

  const visitor: CompanyExportVisitor = {
    async start(header, company) {
      await write(
        `{\n  "schema": ${JSON.stringify(header.schema)},\n  "version": ${header.version},\n` +
          `  "exportedAt": ${JSON.stringify(header.exportedAt)},\n  "data": {\n    "company": ${JSON.stringify(company)}`
      );
    },
    async page(collection, rows) {
      if (collection !== current) {
        if (done.has(collection)) throw new Error("EXPORT_COLLECTION_ORDER");
        await write(`${closeCollection()},\n    ${JSON.stringify(collection)}: [`);
        if (current) done.add(current);
        current = collection;
        items = 0;
      }
      if (!rows.length) return;
      let text = "";
      for (const row of rows) text += `${items++ ? "," : ""}\n      ${JSON.stringify(row)}`;
      await write(text);
    },
  };

  return {
    visitor,
    async finish(summary: CompanyExportSummary) {
      await write(
        `${closeCollection()}\n  },\n  "counts": ${JSON.stringify(summary.counts)},\n` +
          `  "externalAssets": ${JSON.stringify(summary.externalAssets)}\n}\n`
      );
    },
  };
}
