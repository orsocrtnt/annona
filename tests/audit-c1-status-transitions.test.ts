import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "../src/services/prisma/client";
import { getAdminEditableOrderStatuses, isTeamStatusChangeAllowed } from "../src/lib/constants/order-status";
import { updateCompanyOrderStatus } from "../src/domains/order/order.service";
import { adminUpdateDelivery } from "../src/domains/delivery/delivery.service";

function replace(t: TestContext, target: object, key: string, fn: unknown) {
  const original = Reflect.get(target, key);
  Reflect.set(target, key, fn);
  t.after(() => { Reflect.set(target, key, original); });
}

const order = (status: OrderStatus, deliveries: unknown[] = [{ id: "d1", driverId: "driver", missionStartedAt: null }]) => ({
  id: "o1", companyId: "c1", status, deliveryCategory: "STANDARD", deliveries, invoices: [], stops: [],
});

test("C1 : une commande annulée, payée ou livrée ne revient pas en arrière", () => {
  const blocked: Array<[OrderStatus, OrderStatus]> = [
    ["CANCELLED", "DELIVERED"],
    ["CANCELLED", "PENDING"],
    ["PAID", "PENDING"],
    ["DELIVERED", "PENDING"],
    ["DELIVERED", "IN_DELIVERY"],
    ["FAILED", "DELIVERED"],
    ["IN_DELIVERY", "PENDING"],
    ["IN_DELIVERY", "PURCHASING"],
    ["PENDING", "DELIVERED"],
    ["PENDING", "IN_DELIVERY"],
  ];
  for (const [from, to] of blocked) assert.equal(isTeamStatusChangeAllowed(from, to), false, `${from} → ${to}`);
});

test("C1 : le déroulé normal et la replanification d'un échec restent possibles", () => {
  const allowed: Array<[OrderStatus, OrderStatus]> = [
    ["ASSIGNED", "DELIVERED"],
    ["PURCHASING", "IN_DELIVERY"],
    ["IN_DELIVERY", "DELIVERED"],
    ["IN_DELIVERY", "FAILED"],
    ["PENDING", "CANCELLED"],
    ["FAILED", "PENDING"],
  ];
  for (const [from, to] of allowed) assert.equal(isTeamStatusChangeAllowed(from, to), true, `${from} → ${to}`);
});

test("C1 : l'écran ne propose que les changements permis", () => {
  assert.deepEqual(getAdminEditableOrderStatuses("CANCELLED"), ["CANCELLED"]);
  assert.deepEqual(getAdminEditableOrderStatuses("DELIVERED"), ["DELIVERED"]);
  assert.deepEqual(getAdminEditableOrderStatuses("FAILED"), ["PENDING", "FAILED"]);
  assert.ok(!getAdminEditableOrderStatuses("IN_DELIVERY").includes("PENDING"));
});

test("C1 : le serveur refuse de passer une commande annulée à livrée, sans rien écrire", async (t) => {
  replace(t, prisma.order, "findFirst", async () => order("CANCELLED"));
  replace(t, prisma, "$transaction", async () => assert.fail("aucune écriture attendue"));
  await assert.rejects(() => updateCompanyOrderStatus("c1", "o1", "DELIVERED"), /ORDER_STATUS_TRANSITION_INVALID/);
});

test("C1 : le serveur refuse de remettre en attente une commande payée", async (t) => {
  replace(t, prisma.order, "findFirst", async () => order("PAID"));
  replace(t, prisma, "$transaction", async () => assert.fail("aucune écriture attendue"));
  await assert.rejects(() => updateCompanyOrderStatus("c1", "o1", "PENDING"), /ORDER_STATUS_TRANSITION_INVALID/);
});

test("C1 : « en livraison » exige une mission démarrée", async (t) => {
  replace(t, prisma.order, "findFirst", async () => order("ASSIGNED"));
  replace(t, prisma, "$transaction", async () => assert.fail("aucune écriture attendue"));
  await assert.rejects(() => updateCompanyOrderStatus("c1", "o1", "IN_DELIVERY"), /ORDER_STATUS_TRANSITION_INVALID/);
});

test("C1 : la voie livraison applique la même règle", async (t) => {
  replace(t, prisma.delivery, "findFirst", async () => ({
    id: "d1", status: "CANCELLED", driverId: null, missionStartedAt: null, completedAt: null, order: { id: "o1", status: "CANCELLED" },
  }));
  replace(t, prisma, "$transaction", async () => assert.fail("aucune écriture attendue"));
  await assert.rejects(() => adminUpdateDelivery("c1", "d1", { status: "DELIVERED" }), /ORDER_STATUS_TRANSITION_INVALID/);
});
