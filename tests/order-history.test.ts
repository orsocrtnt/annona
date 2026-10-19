import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { prisma } from "../src/services/prisma/client";
import {
  buildOrderHistoryWhere,
  csvCell,
  exportOrderHistoryCsv,
  listClientOrderHistory,
  listCompanyOrderHistory,
} from "../src/domains/order/order.service";
import { parseOrderHistoryQuery } from "../src/lib/validations/order-history";
import type { OrderHistoryQuery } from "../src/lib/query/order-history";

function replaceMethod(
  t: TestContext,
  target: object,
  key: string,
  value: CallableFunction
) {
  const previous = Reflect.get(target, key);
  Reflect.set(target, key, value);
  t.after(() => Reflect.set(target, key, previous));
}

const query: OrderHistoryQuery = { page: 2, pageSize: 50 };

test("DATA-01 valide et borne les paramètres de recherche", () => {
  const parsed = parseOrderHistoryQuery("http://local/api/orders?page=2&pageSize=100&search=%20ABC%20&status=DELIVERED&category=COURIER&from=2026-01-01&to=2026-12-31");
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(parsed.data, {
      page: 2,
      pageSize: 100,
      search: "ABC",
      status: "DELIVERED",
      category: "COURIER",
      from: "2026-01-01",
      to: "2026-12-31",
      history: undefined,
    });
  }
  assert.equal(parseOrderHistoryQuery("http://local/api/orders?pageSize=1000").success, false);
  assert.equal(parseOrderHistoryQuery("http://local/api/orders?from=2026-02-01&to=2026-01-01").success, false);
  assert.equal(parseOrderHistoryQuery("http://local/api/orders?from=2026-02-30").success, false);
  assert.equal(parseOrderHistoryQuery("http://local/api/orders?status=UNKNOWN").success, false);
});

test("DATA-01 compose recherche, filtres et frontière d'entreprise", () => {
  const where = buildOrderHistoryWhere(
    { companyId: "company-a" },
    { ...query, search: "ancienne", status: "DELIVERED", category: "STANDARD", from: "2026-01-01", to: "2026-01-31" }
  ) as { AND: Array<Record<string, unknown>> };
  assert.equal(where.AND[0]?.companyId, "company-a");
  assert.deepEqual(where.AND[1], { status: "DELIVERED" });
  assert.deepEqual(where.AND[2], { deliveryCategory: "STANDARD" });
  assert.ok("createdAt" in where.AND[3]!);
  assert.ok("OR" in where.AND[4]!);
});

test("DATA-01 pagination serveur stable pour entreprise et client", async (t) => {
  const calls: Array<Record<string, unknown>> = [];
  replaceMethod(t, prisma.order, "findMany", async (args: Record<string, unknown>) => {
    calls.push(args);
    return [{
      id: "order-1", reference: "REF-1", status: "DELIVERED", source: "CLIENT",
      totalAmount: { toString: () => "10.00" }, itemCount: 1, createdAt: new Date(),
      requestedDeliveryDate: null, deliveryCategory: "STANDARD", customerEmail: null,
      shippingAddress: null, shippingCity: null, shippingPostalCode: null,
      customer: { firstName: "Client", lastName: "A", email: "a@example.com" },
      deliveries: [], _count: { deliveries: 0, invoices: 0 },
    }] as never;
  });
  replaceMethod(t, prisma.order, "count", async () => 1_000);

  const staff = await listCompanyOrderHistory("company-a", query);
  assert.equal(staff.total, 1_000);
  assert.equal(staff.totalPages, 20);
  assert.equal(staff.page, 2);
  assert.equal(calls[0]?.skip, 50);
  assert.equal(calls[0]?.take, 50);
  assert.deepEqual(calls[0]?.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  assert.deepEqual((calls[0]?.where as { AND: unknown[] }).AND[0], { companyId: "company-a" });

  calls.length = 0;
  const client = await listClientOrderHistory("client-a", "company-a", { ...query, history: true });
  assert.equal(client.total, 1_000);
  const scope = (calls[0]?.where as { AND: Array<Record<string, unknown>> }).AND;
  assert.deepEqual(scope[0], { customerId: "client-a", companyId: "company-a" });
  assert.deepEqual(scope[1], { status: { in: ["DELIVERED", "INVOICED", "PAID", "CANCELLED", "FAILED"] } });
});

test("DATA-01 exporte 1 000 lignes par lots, dans un ordre stable et sans formule CSV", async (t) => {
  const rows = Array.from({ length: 1_000 }, (_, index) => ({
    id: `order-${String(999 - index).padStart(4, "0")}`,
    reference: index === 0 ? "=FORMULE" : `REF-${String(999 - index).padStart(4, "0")}`,
    status: "DELIVERED",
    source: "CLIENT",
    deliveryCategory: "STANDARD",
    totalAmount: { toString: () => "10.00" },
    itemCount: 1,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 1_000 - index)),
    requestedDeliveryDate: null,
    customerEmail: "client@example.com",
    shippingAddress: "1 rue Test",
    shippingCity: "Paris",
    shippingPostalCode: "75001",
    customer: { firstName: "Client", lastName: "Test", email: "client@example.com" },
  }));
  const calls: Array<Record<string, unknown>> = [];
  replaceMethod(t, prisma.order, "findMany", async (args: Record<string, unknown>) => {
    calls.push(args);
    if (!args.cursor) return rows.slice(0, 500) as never;
    const id = (args.cursor as { id: string }).id;
    const start = rows.findIndex((row) => row.id === id) + 1;
    return rows.slice(start, start + 500) as never;
  });

  const csv = await exportOrderHistoryCsv("company-a", { page: 1, pageSize: 50 }, { includeCustomer: true });
  const lines = csv.split("\r\n").filter(Boolean);
  assert.equal(lines.length, 1_001);
  assert.match(lines[1]!, /^"'=FORMULE"/);
  assert.match(lines.at(-1)!, /"REF-0000"/);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.deepEqual((call.where as { AND: unknown[] }).AND[0], { companyId: "company-a" });
    assert.deepEqual(call.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
    assert.equal(call.take, 500);
  }
  assert.equal(csvCell("+1"), '"\'+1"');
  assert.equal(csvCell("  =1+1"), '"\'  =1+1"');
  assert.equal(csvCell('a"b'), '"a""b"');
});
