/**
 * Base en mémoire pour les tests DEMO-3 (factures, relances, tâches durables).
 * Reproduit uniquement les filtres Prisma utilisés par les services testés ;
 * un filtre inconnu fait échouer le test plutôt que d'être ignoré.
 * `$transaction` sérialise les transactions (comme le verrou FOR UPDATE).
 */

import { Prisma } from "@prisma/client";

type Row = Record<string, unknown>;

/** Seule requête brute simulée : le passage en retard (sans toucher updated_at). */
const OVERDUE_SQL = /^UPDATE "invoices" SET "status" = 'OVERDUE'::"InvoiceStatus" WHERE "status" = 'PENDING'::"InvoiceStatus" AND "due_date" < \(\$1::timestamptz AT TIME ZONE 'UTC'\)( AND "company_id" = \$2)?$/;

export type FakeInvoice = {
  id: string;
  reference: string;
  status: "DRAFT" | "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
  amount: number;
  lineItems: unknown[];
  notes: string | null;
  dueDate: Date | null;
  paidAt: Date | null;
  companyId: string;
  orderId: string | null;
  customerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FakeReminder = {
  id: string;
  invoiceId: string;
  companyId: string;
  sentById: string | null;
  channel: string;
  result: string;
  operationJobId: string | null;
  completedAt: Date | null;
  createdAt: Date;
};

export type FakeJob = {
  id: string;
  jobKey: string;
  type: string;
  status: string;
  payload: Row;
  companyId: string | null;
  maxAttempts: number;
};

function matchValue(actual: unknown, condition: unknown): boolean {
  if (condition && typeof condition === "object" && !(condition instanceof Date) && !Array.isArray(condition)) {
    const c = condition as Row;
    for (const key of Object.keys(c)) {
      if (!["in", "lt", "lte", "gte", "gt", "not"].includes(key)) throw new Error(`filtre non simulé : ${key}`);
    }
    if ("in" in c && !(c.in as unknown[]).includes(actual)) return false;
    if ("not" in c && actual === c.not) return false;
    const time = (value: unknown) => (value instanceof Date ? value.getTime() : null);
    if ("lt" in c) { const a = time(actual); if (a === null || a >= time(c.lt)!) return false; }
    if ("lte" in c) { const a = time(actual); if (a === null || a > time(c.lte)!) return false; }
    if ("gte" in c) { const a = time(actual); if (a === null || a < time(c.gte)!) return false; }
    if ("gt" in c) { const a = time(actual); if (a === null || a <= time(c.gt)!) return false; }
    return true;
  }
  if (actual instanceof Date && condition instanceof Date) return actual.getTime() === condition.getTime();
  return actual === condition;
}

export function matches(row: Row, where: Row = {}): boolean {
  for (const [key, condition] of Object.entries(where)) {
    if (condition === undefined) continue;
    if (key === "OR") {
      if (!(condition as Row[]).some((part) => matches(row, part))) return false;
      continue;
    }
    if (!matchValue(row[key], condition)) return false;
  }
  return true;
}

export function createInvoiceFakeDb(seed: {
  invoices?: FakeInvoice[];
  reminders?: FakeReminder[];
  jobs?: FakeJob[];
  users?: Array<{ id: string; companyId: string | null; email: string; firstName: string; lastName: string }>;
  orders?: Array<{ id: string; companyId: string; reference: string }>;
  companies?: Array<{ id: string; name: string; settings: unknown }>;
} = {}) {
  const invoices = seed.invoices ?? [];
  const reminders = seed.reminders ?? [];
  const jobs = seed.jobs ?? [];
  const users = seed.users ?? [];
  const orders = seed.orders ?? [];
  const companies = seed.companies ?? [];
  const log: string[] = [];
  let sequence = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let clock = new Date("2026-10-28T09:00:00.000Z").getTime();
  const tick = () => new Date((clock += 1000));

  const withInvoiceRelations = (invoice: FakeInvoice) => {
    const customer = users.find((user) => user.id === invoice.customerId) ?? null;
    const order = orders.find((candidate) => candidate.id === invoice.orderId) ?? null;
    const company = companies.find((candidate) => candidate.id === invoice.companyId) ?? null;
    const last = reminders
      .filter((reminder) => reminder.invoiceId === invoice.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((reminder) => ({ ...reminder, operationJob: jobs.find((job) => job.id === reminder.operationJobId) ?? null }));
    return { ...invoice, customer, order, company, reminders: last };
  };

  const db = {
    log,
    invoices,
    reminders,
    jobs,
    async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      log.push(`lock:${strings.join("?").replace(/\s+/g, " ").trim()}:${values.join(",")}`);
      return [];
    },
    /** Requête brute exécutée, telle que Prisma l'enverrait (texte + paramètres). */
    executed: [] as Array<{ sql: string; values: unknown[] }>,
    beforeRawUpdate: null as null | (() => void),
    async $executeRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      const query = Prisma.sql(strings, ...values);
      const sql = query.text.replace(/\s+/g, " ").trim();
      db.executed.push({ sql, values: query.values });
      const match = OVERDUE_SQL.exec(sql);
      if (!match) throw new Error(`SQL non simulé : ${sql}`);
      db.beforeRawUpdate?.();
      const [cutoff, companyId] = query.values as [Date, string | undefined];
      let count = 0;
      for (const row of invoices) {
        if (row.status !== "PENDING" || !row.dueDate || row.dueDate.getTime() >= cutoff.getTime()) continue;
        if (match[1] && row.companyId !== companyId) continue;
        row.status = "OVERDUE"; // updated_at volontairement inchangé
        count += 1;
      }
      return count;
    },
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      const run = queue.then(() => fn(db));
      queue = run.catch(() => undefined);
      return run;
    },
    invoice: {
      async findFirst(args: { where: Row }) {
        const found = invoices.find((invoice) => matches(invoice, args.where));
        return found ? withInvoiceRelations(found) : null;
      },
      async findMany(args: { where: Row; take?: number }) {
        const rows = invoices
          .filter((invoice) => matches(invoice, args.where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map(withInvoiceRelations);
        return args.take ? rows.slice(0, args.take) : rows;
      },
      async count(args: { where: Row }) {
        return invoices.filter((invoice) => matches(invoice, args.where)).length;
      },
      async groupBy(args: { where: Row }) {
        const counts = new Map<string, number>();
        for (const invoice of invoices.filter((row) => matches(row, args.where))) {
          counts.set(invoice.status, (counts.get(invoice.status) ?? 0) + 1);
        }
        return [...counts].map(([status, count]) => ({ status, _count: { _all: count } }));
      },
      async updateMany(args: { where: Row; data: Partial<FakeInvoice> }) {
        let count = 0;
        for (const invoice of invoices) {
          if (!matches(invoice, args.where)) continue;
          Object.assign(invoice, args.data, { updatedAt: tick() });
          count += 1;
        }
        log.push(`invoice.updateMany:${count}`);
        return { count };
      },
      async findUniqueOrThrow(args: { where: { id: string } }) {
        const found = invoices.find((invoice) => invoice.id === args.where.id);
        if (!found) throw new Error("NOT_FOUND");
        return { ...found };
      },
    },
    invoiceReminder: {
      async findMany(args: { where: Row; take?: number }) {
        return reminders
          .filter((reminder) => matches(reminder, args.where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, args.take ?? Infinity)
          .map((found) => ({ ...found, operationJob: jobs.find((job) => job.id === found.operationJobId) ?? null }));
      },
      async findFirst(args: { where: Row }) {
        const found = reminders
          .filter((reminder) => matches(reminder, args.where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        if (!found) return null;
        const invoice = invoices.find((candidate) => candidate.id === found.invoiceId);
        return {
          ...found,
          operationJob: jobs.find((job) => job.id === found.operationJobId) ?? null,
          invoice: invoice ? withInvoiceRelations(invoice) : null,
        };
      },
      async create(args: { data: Omit<FakeReminder, "id" | "createdAt" | "operationJobId" | "completedAt"> & Partial<FakeReminder> }) {
        const row: FakeReminder = {
          id: `rem_${++sequence}`,
          operationJobId: null,
          completedAt: null,
          createdAt: tick(),
          ...args.data,
        } as FakeReminder;
        reminders.push(row);
        log.push(`reminder.create:${row.result}`);
        return { ...row };
      },
      async update(args: { where: { id: string }; data: Partial<FakeReminder> }) {
        const row = reminders.find((reminder) => reminder.id === args.where.id);
        if (!row) throw new Error("NOT_FOUND");
        Object.assign(row, args.data);
        return { ...row };
      },
      async updateMany(args: { where: Row; data: Partial<FakeReminder> }) {
        let count = 0;
        for (const row of reminders) {
          if (!matches(row, args.where)) continue;
          Object.assign(row, args.data);
          count += 1;
        }
        return { count };
      },
    },
    operationJob: {
      async upsert(args: { where: { jobKey: string }; create: Omit<FakeJob, "id" | "status"> }) {
        const existing = jobs.find((job) => job.jobKey === args.where.jobKey);
        if (existing) return { id: existing.id, jobKey: existing.jobKey, status: existing.status };
        const job: FakeJob = { id: `job_${++sequence}`, status: "PENDING", ...args.create } as FakeJob;
        jobs.push(job);
        log.push(`job.upsert:${job.jobKey}`);
        return { id: job.id, jobKey: job.jobKey, status: job.status };
      },
    },
    company: {
      async findUnique(args: { where: { id: string } }) {
        const found = companies.find((company) => company.id === args.where.id);
        return found ? { ...found } : null;
      },
    },
  };
  return db;
}

export function invoice(overrides: Partial<FakeInvoice> & { id: string }): FakeInvoice {
  return {
    reference: `FAC-${overrides.id.toUpperCase()}`,
    status: "PENDING",
    amount: 45,
    lineItems: [],
    notes: null,
    dueDate: new Date("2026-10-20T10:00:00.000Z"),
    paidAt: null,
    companyId: "company_a",
    orderId: null,
    customerId: "client_a",
    createdAt: new Date("2026-09-20T10:00:00.000Z"),
    updatedAt: new Date("2026-09-20T10:00:00.000Z"),
    ...overrides,
  };
}
