import assert from "node:assert/strict";
import test from "node:test";
import { effectiveInvoiceStatus } from "../src/domains/invoice/invoice-due";
import { canOpenStaffInbox, canUseConversations, STAFF_INBOX_PERMISSIONS } from "../src/lib/constants/conversation-roles";

test("RECETTE-2810 point 5 : une facture PENDING échue s'affiche en retard à la lecture, comme Paiements", () => {
  const now = new Date("2026-10-29T10:00:00Z");
  assert.deepEqual(effectiveInvoiceStatus({ status: "PENDING", dueDate: "2026-10-24T08:00:00Z" }, now), { status: "OVERDUE", daysOverdue: 5 });
  assert.deepEqual(effectiveInvoiceStatus({ status: "PENDING", dueDate: "2026-10-29T08:00:00Z" }, now), { status: "PENDING", daysOverdue: 0 });
  assert.deepEqual(effectiveInvoiceStatus({ status: "PENDING", dueDate: null }, now), { status: "PENDING", daysOverdue: 0 });
  assert.deepEqual(effectiveInvoiceStatus({ status: "PAID", dueDate: "2026-10-01T00:00:00Z" }, now), { status: "PAID", daysOverdue: 0 });
  assert.equal(effectiveInvoiceStatus({ status: "OVERDUE", dueDate: "2026-10-24T08:00:00Z" }, now).daysOverdue, 5);
});

test("RECETTE-2810 point 4 : le super-administrateur n'appelle pas les API d'échanges et d'alertes", () => {
  assert.equal(canUseConversations("SUPER_ADMIN"), false);
  assert.equal(canUseConversations(undefined), false);
  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"]) assert.equal(canUseConversations(role), true);
});

test("RECETTE-2810 point 4 : la liste de rôles de l'interface reste celle de conversationAuth", async () => {
  const { readFileSync } = await import("node:fs");
  const { CONVERSATION_ROLES } = await import("../src/lib/constants/conversation-roles");
  const source = readFileSync("src/lib/api/conversation-auth.ts", "utf8");
  assert.ok(source.includes(JSON.stringify([...CONVERSATION_ROLES]).replace(/,/g, ", ")));
});

test("SEC-AUDIT : un mini-admin sans lecture des commandes ni des livraisons ne monte pas la boîte d'échanges (403 évités)", async () => {
  assert.equal(canOpenStaffInbox("MINI_ADMIN", ["support:read", "tickets:update"]), false);
  assert.equal(canOpenStaffInbox("MINI_ADMIN", ["deliveries:read"]), true);
  assert.equal(canOpenStaffInbox("DISPATCHER", ["orders:read"]), true);
  assert.equal(canOpenStaffInbox("SUPER_ADMIN", ["orders:read", "deliveries:read"]), false);
  // Même liste que la règle serveur de conversationScope.
  const { readFileSync } = await import("node:fs");
  const service = readFileSync("src/domains/order-conversation/order-conversation.service.ts", "utf8");
  assert.ok(service.includes(JSON.stringify([...STAFF_INBOX_PERMISSIONS]).replace(/,/g, ", ")));
});
