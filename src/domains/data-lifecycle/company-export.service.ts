import { Prisma, type Invoice, type RecurringOrder } from "@prisma/client";
import { prisma } from "@/services/prisma/client";

/**
 * Export portable du périmètre d'une entreprise.
 *
 * Les identifiants relationnels sont conservés pour permettre une reprise, mais
 * les identifiants Supabase Auth, clés d'idempotence, empreintes de requête,
 * charges de jobs et erreurs internes sont exclus.
 * `companyCustomers` (fiches clients sans accès) est un ajout compatible de la version 1.
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
  role: { select: { name: true, slug: true, systemRole: true } },
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  addresses: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  driverLocation: true,
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

const ORDER_SELECT = {
  id: true,
  companyId: true,
  reference: true,
  status: true,
  source: true,
  totalAmount: true,
  itemCount: true,
  notes: true,
  deliveryCategory: true,
  pickupAddress: true,
  pickupCity: true,
  pickupPostalCode: true,
  pickupInstructions: true,
  shippingAddress: true,
  shippingCity: true,
  shippingPostalCode: true,
  deliveryInstructions: true,
  requestedDeliveryDate: true,
  missionDescription: true,
  customerId: true,
  customerEmail: true,
  companyCustomerId: true,
  recurringOrderId: true,
  createdAt: true,
  updatedAt: true,
  items: { orderBy: { id: "asc" } },
  stops: { orderBy: [{ sequence: "asc" }, { id: "asc" }] },
  deliveries: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      trackingEvents: {
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      },
    },
  },
} satisfies Prisma.OrderSelect;

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

const COMPANY_CUSTOMER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanyCustomerSelect;

export type ExportedCompany = Prisma.CompanyGetPayload<{ select: typeof COMPANY_SELECT }>;

export interface CompanyExportRows {
  users: Prisma.UserGetPayload<{ select: typeof USER_SELECT }>[];
  companyCustomers: Prisma.CompanyCustomerGetPayload<{ select: typeof COMPANY_CUSTOMER_SELECT }>[];
  recurringOrders: RecurringOrder[];
  orders: Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>[];
  invoices: Invoice[];
  supportTickets: Prisma.SupportTicketGetPayload<{ include: typeof SUPPORT_TICKET_INCLUDE }>[];
  operationJobs: Prisma.OperationJobGetPayload<{ select: typeof OPERATION_JOB_SELECT }>[];
}

export type CompanyExportCollection = keyof CompanyExportRows;

export interface CompanyExportHeader {
  schema: "annona-company-export";
  version: 1;
  exportedAt: string;
}

export interface CompanyExportProofObject {
  deliveryId: string;
  deliveryReference: string;
  objectKey: string;
  /** Absent pour la photo de preuve ; « signature » pour la signature du réceptionnaire. */
  kind?: "signature";
}

export interface CompanyExportSummary extends CompanyExportHeader {
  counts: Record<
    | "users" | "companyCustomers" | "addresses" | "notifications" | "recurringOrders" | "orders" | "items" | "stops"
    | "deliveries" | "trackingEvents" | "invoices"
    | "supportTickets" | "supportMessages" | "operationJobs" | "proofObjects",
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
    version: 1,
    exportedAt: new Date().toISOString(),
  };
  const counts: CompanyExportSummary["counts"] = {
    users: 0,
    companyCustomers: 0,
    addresses: 0,
    notifications: 0,
    recurringOrders: 0,
    orders: 0,
    items: 0,
    stops: 0,
    deliveries: 0,
    trackingEvents: 0,
    invoices: 0,
    supportTickets: 0,
    supportMessages: 0,
    operationJobs: 0,
    proofObjects: 0,
  };
  const proofObjects: CompanyExportProofObject[] = [];

  const found = await prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({ where: { id: companyId }, select: COMPANY_SELECT });
    if (!company) return false;
    await visitor.start(header, company);

    await forEachPage(
      pageSize,
      (after) => tx.user.findMany({
        where: pageWhere(companyId, after),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: pageSize,
        select: USER_SELECT,
      }),
      async (rows) => {
        counts.users += rows.length;
        for (const user of rows) {
          counts.addresses += user.addresses.length;
          counts.notifications += user.notifications.length;
        }
        await visitor.page("users", rows);
      }
    );
    await forEachPage(
      pageSize,
      (after) => tx.companyCustomer.findMany({
        where: pageWhere(companyId, after),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: pageSize,
        select: COMPANY_CUSTOMER_SELECT,
      }),
      async (rows) => {
        counts.companyCustomers += rows.length;
        await visitor.page("companyCustomers", rows);
      }
    );
    await forEachPage(
      pageSize,
      (after) => tx.recurringOrder.findMany({
        where: pageWhere(companyId, after),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: pageSize,
      }),
      async (rows) => {
        counts.recurringOrders += rows.length;
        await visitor.page("recurringOrders", rows);
      }
    );
    await forEachPage(
      pageSize,
      (after) => tx.order.findMany({
        where: pageWhere(companyId, after),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: pageSize,
        select: ORDER_SELECT,
      }),
      async (rows) => {
        counts.orders += rows.length;
        for (const order of rows) {
          counts.items += order.items.length;
          counts.stops += order.stops.length;
          counts.deliveries += order.deliveries.length;
          for (const delivery of order.deliveries) {
            counts.trackingEvents += delivery.trackingEvents.length;
            if (delivery.podPhotoPath) {
              proofObjects.push({
                deliveryId: delivery.id,
                deliveryReference: delivery.reference,
                objectKey: delivery.podPhotoPath,
              });
            }
            if (delivery.podSignaturePath) {
              proofObjects.push({
                deliveryId: delivery.id,
                deliveryReference: delivery.reference,
                objectKey: delivery.podSignaturePath,
                kind: "signature",
              });
            }
          }
        }
        await visitor.page("orders", rows);
      }
    );
    await forEachPage(
      pageSize,
      (after) => tx.invoice.findMany({
        where: pageWhere(companyId, after),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: pageSize,
      }),
      async (rows) => {
        counts.invoices += rows.length;
        await visitor.page("invoices", rows);
      }
    );
    await forEachPage(
      pageSize,
      (after) => tx.supportTicket.findMany({
        where: pageWhere(companyId, after),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: pageSize,
        include: SUPPORT_TICKET_INCLUDE,
      }),
      async (rows) => {
        counts.supportTickets += rows.length;
        for (const ticket of rows) counts.supportMessages += ticket.messages.length;
        await visitor.page("supportTickets", rows);
      }
    );
    await forEachPage(
      pageSize,
      (after) => tx.operationJob.findMany({
        where: pageWhere(companyId, after),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: pageSize,
        select: OPERATION_JOB_SELECT,
      }),
      async (rows) => {
        counts.operationJobs += rows.length;
        await visitor.page("operationJobs", rows);
      }
    );
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
      note: "Les fichiers binaires doivent être exportés séparément depuis le bucket privé.",
    },
  };
}

/** Export complet en mémoire, pour les recettes et les petites entreprises. */
export async function exportCompanyData(companyId: string, options: { pageSize?: number } = {}) {
  let company: ExportedCompany | null = null;
  const data: CompanyExportRows = {
    users: [],
    companyCustomers: [],
    recurringOrders: [],
    orders: [],
    invoices: [],
    supportTickets: [],
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
 * Sérialise l'export au fil des pages, dans le même document v1 que `exportCompanyData`
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
