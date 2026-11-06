/**
 * Base Prisma en mémoire pour les tests CAT-1 et CMD-1. Reproduit seulement ce dont les services
 * testés ont besoin : égalité, `in`, `gte`/`gt`/`lte`/`lt`, `not`, clés uniques composées
 * (`merchantId_productId: {…}`), `OR`. Un filtre inconnu fait échouer le test plutôt que d'être ignoré.
 * `select` et `include` sont ignorés : la ligne complète est renvoyée, enrichie par `decorate`.
 */
type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const OPERATORS = new Set(["in", "notIn", "gte", "gt", "lte", "lt", "not", "equals"]);

function comparable(value: unknown) {
  return value instanceof Date ? value.getTime() : (value as number | string);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !(value instanceof Date) && !Array.isArray(value);
}

function matchField(actual: unknown, condition: unknown): boolean {
  if (!isPlainObject(condition)) return comparable(actual) === comparable(condition);
  for (const [operator, expected] of Object.entries(condition)) {
    if (!OPERATORS.has(operator)) throw new Error(`memory-db : opérateur non simulé « ${operator} »`);
    const a = comparable(actual);
    if (operator === "in" && !(expected as unknown[]).map(comparable).includes(a)) return false;
    if (operator === "notIn" && (expected as unknown[]).map(comparable).includes(a)) return false;
    if (operator === "equals" && a !== comparable(expected)) return false;
    if (operator === "not" && a === comparable(expected)) return false;
    if (operator === "gte" && !(a >= comparable(expected))) return false;
    if (operator === "gt" && !(a > comparable(expected))) return false;
    if (operator === "lte" && !(a <= comparable(expected))) return false;
    if (operator === "lt" && !(a < comparable(expected))) return false;
  }
  return true;
}

export function matches(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  for (const [key, condition] of Object.entries(where)) {
    if (condition === undefined) continue;
    if (key === "OR") {
      if (!(condition as Where[]).some((part) => matches(row, part))) return false;
      continue;
    }
    if (key === "AND") {
      if (!(condition as Where[]).every((part) => matches(row, part))) return false;
      continue;
    }
    if (key.includes("_") && isPlainObject(condition) && !Object.keys(condition).some((k) => OPERATORS.has(k))) {
      // Clé unique composée : merchantId_deliveryDate_slotId: { merchantId, deliveryDate, slotId }.
      if (!matches(row, condition)) return false;
      continue;
    }
    if (!(key in row) && isPlainObject(condition)) throw new Error(`memory-db : filtre de relation non simulé « ${key} »`);
    if (!matchField(row[key], condition)) return false;
  }
  return true;
}

let sequence = 0;

export interface MemoryDbOptions {
  /** Ajoute les relations attendues par le service (ex. `category` d'un produit). */
  decorate?: Record<string, (row: Row, tables: Record<string, Row[]>) => Row>;
}

export function createMemoryDb(tables: Record<string, Row[]>, options: MemoryDbOptions = {}) {
  const view = (model: string, row: Row) => {
    const decorate = options.decorate?.[model];
    return decorate ? { ...row, ...decorate(row, tables) } : { ...row };
  };

  function delegate(model: string) {
    const rows = () => (tables[model] ??= []);
    const create = (data: Row) => {
      const now = new Date();
      const row: Row = { id: `${model}_${++sequence}`, createdAt: now, updatedAt: now, ...data };
      rows().push(row);
      return row;
    };
    return {
      findFirst: async ({ where }: { where?: Where } = {}) => {
        const row = rows().find((candidate) => matches(candidate, where));
        return row ? view(model, row) : null;
      },
      findUnique: async ({ where }: { where: Where }) => {
        const row = rows().find((candidate) => matches(candidate, where));
        return row ? view(model, row) : null;
      },
      findMany: async ({ where, take }: { where?: Where; take?: number } = {}) => {
        const found = rows().filter((candidate) => matches(candidate, where)).map((row) => view(model, row));
        return typeof take === "number" ? found.slice(0, take) : found;
      },
      count: async ({ where }: { where?: Where } = {}) => rows().filter((candidate) => matches(candidate, where)).length,
      create: async ({ data }: { data: Row }) => view(model, create(data)),
      createMany: async ({ data }: { data: Row[] }) => {
        data.forEach(create);
        return { count: data.length };
      },
      update: async ({ where, data }: { where: Where; data: Row }) => {
        const row = rows().find((candidate) => matches(candidate, where));
        if (!row) throw Object.assign(new Error("Record to update not found."), { code: "P2025" });
        Object.assign(row, data, { updatedAt: new Date() });
        return view(model, row);
      },
      updateMany: async ({ where, data }: { where: Where; data: Row }) => {
        const found = rows().filter((candidate) => matches(candidate, where));
        found.forEach((row) => Object.assign(row, data, { updatedAt: new Date() }));
        return { count: found.length };
      },
      upsert: async ({ where, update, create: createData }: { where: Where; update: Row; create: Row }) => {
        const row = rows().find((candidate) => matches(candidate, where));
        if (row) {
          Object.assign(row, update, { updatedAt: new Date() });
          return view(model, row);
        }
        return view(model, create(createData));
      },
      delete: async ({ where }: { where: Where }) => {
        const index = rows().findIndex((candidate) => matches(candidate, where));
        if (index < 0) throw Object.assign(new Error("Record to delete does not exist."), { code: "P2025" });
        return rows().splice(index, 1)[0];
      },
      deleteMany: async ({ where }: { where?: Where } = {}) => {
        const kept = rows().filter((candidate) => !matches(candidate, where));
        const count = rows().length - kept.length;
        tables[model] = kept;
        return { count };
      },
    };
  }

  const db: Record<string, unknown> = {
    $transaction: async (arg: unknown) => {
      if (typeof arg === "function") return (arg as (tx: unknown) => Promise<unknown>)(db);
      return Promise.all(arg as Promise<unknown>[]);
    },
  };
  for (const model of ["company", "merchant", "category", "product", "merchantPrice", "slot", "order", "orderLine", "recurringOrder", "recurringOrderLine"]) {
    db[model] = delegate(model);
  }
  return db;
}
