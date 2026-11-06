import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { prisma } from "../../src/services/prisma/client";
import {
  addClientTicketMessage,
  addStaffTicketMessage,
  createClientTicket,
  getClientTicketById,
  getStaffTicketById,
  getStaffTickets,
  updateStaffTicketStatus,
} from "../../src/domains/support/support.service";

const fixtureKey = `support1-${randomUUID()}`;
const outputPath = resolve(process.argv[2] ?? "outputs/support1/connected.json");
type FixtureCompany = {
  id: string;
  admin: { id: string };
  client: { id: string };
};

async function createCompany(
  suffix: "a" | "b",
  roles: { COMPANY_ADMIN: string; CLIENT: string }
): Promise<FixtureCompany> {
  const slug = `${fixtureKey}-${suffix}`;
  const company = await prisma.company.create({
    data: { name: `SUPPORT-1 — ${suffix.toUpperCase()}`, slug, isDemo: true },
  });
  const [admin, client] = await Promise.all([
    prisma.user.create({
      data: {
        authId: `${slug}-admin`,
        email: `admin@${slug}.invalid`,
        firstName: "Admin",
        lastName: `SUPPORT-1 ${suffix.toUpperCase()}`,
        status: "ACTIVE",
        companyId: company.id,
        roleId: roles.COMPANY_ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        authId: `${slug}-client`,
        email: `client@${slug}.invalid`,
        firstName: "Client",
        lastName: `SUPPORT-1 ${suffix.toUpperCase()}`,
        status: "ACTIVE",
        companyId: company.id,
        roleId: roles.CLIENT,
      },
    }),
  ]);
  return { id: company.id, admin, client };
}

async function cleanup() {
  const companies = await prisma.company.findMany({
    where: { slug: { startsWith: fixtureKey } },
    select: { id: true },
  });
  const companyIds = companies.map(({ id }) => id);
  if (companyIds.length === 0) return;
  const users = await prisma.user.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  await prisma.clientNotification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.supportTicket.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

async function residue() {
  const [companies, users, tickets, messages, notifications] = await Promise.all([
    prisma.company.count({ where: { slug: { startsWith: fixtureKey } } }),
    prisma.user.count({ where: { authId: { startsWith: fixtureKey } } }),
    prisma.supportTicket.count({ where: { company: { slug: { startsWith: fixtureKey } } } }),
    prisma.supportTicketMessage.count({
      where: { ticket: { company: { slug: { startsWith: fixtureKey } } } },
    }),
    prisma.clientNotification.count({
      where: { user: { company: { slug: { startsWith: fixtureKey } } } },
    }),
  ]);
  return { companies, users, tickets, messages, notifications };
}

async function scenario() {
  const roleRows = await prisma.role.findMany({
    where: { systemRole: { in: ["ADMIN", "MERCHANT"] } },
    select: { id: true, systemRole: true },
  });
  const roles = Object.fromEntries(roleRows.map((role) => [role.systemRole, role.id])) as {
    COMPANY_ADMIN: string;
    CLIENT: string;
  };
  assert.ok(roles.COMPANY_ADMIN && roles.CLIENT, "SUPPORT1_ROLES_MISSING");

  const [companyA, companyB] = await Promise.all([
    createCompany("a", roles),
    createCompany("b", roles),
  ]);
  const ticketA = await createClientTicket(companyA.client.id, companyA.id, {
    subject: "SUPPORT-1 — colis en attente",
    message: "Je souhaite connaître la prochaine étape de cette livraison fictive.",
    contactType: "ADMIN",
  });
  await createClientTicket(companyB.client.id, companyB.id, {
    subject: "SUPPORT-1 — entreprise B",
    message: "Cette demande doit rester strictement dans l’entreprise B.",
    contactType: "ADMIN",
  });

  const [listA, listB] = await Promise.all([
    getStaffTickets(companyA.id),
    getStaffTickets(companyB.id),
  ]);
  assert.equal(listA.length, 1);
  assert.equal(listB.length, 1);
  assert.equal(await getStaffTicketById(companyB.id, ticketA.id), null);
  assert.equal(
    await addStaffTicketMessage(
      companyB.admin.id,
      companyB.id,
      ticketA.id,
      "Réponse interdite"
    ),
    null
  );
  assert.equal(await updateStaffTicketStatus(companyB.id, ticketA.id, "RESOLVED"), null);

  const replied = await addStaffTicketMessage(
    companyA.admin.id,
    companyA.id,
    ticketA.id,
    "Votre demande est prise en charge dans Annona."
  );
  assert.equal(replied?.ticket.status, "IN_PROGRESS");
  const resolved = await updateStaffTicketStatus(companyA.id, ticketA.id, "RESOLVED");
  assert.equal(resolved?.status, "RESOLVED");

  const clientResolved = await getClientTicketById(companyA.client.id, companyA.id, ticketA.id);
  assert.equal(clientResolved?.status, "RESOLVED");
  assert.equal(clientResolved?.messages.length, 2);
  assert.equal(clientResolved?.messages[1]?.isStaff, true);

  await addClientTicketMessage(
    companyA.client.id,
    companyA.id,
    ticketA.id,
    "Merci, je confirme avoir reçu votre réponse."
  );
  const reopened = await getClientTicketById(companyA.client.id, companyA.id, ticketA.id);
  assert.equal(reopened?.status, "OPEN");
  assert.equal(reopened?.messages.length, 3);

  const notifications = await prisma.clientNotification.findMany({
    where: { userId: companyA.client.id, type: "SUPPORT" },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(notifications.length, 2);
  assert.ok(notifications.every((notification) => notification.href === `/portal/support/${ticketA.id}`));

  return {
    task: "SUPPORT-1",
    passed: true,
    companies: 2,
    staffReception: listA.length === 1 && listB.length === 1,
    staffReply: replied?.ticket.status === "IN_PROGRESS",
    clientNotification: notifications.length === 2,
    resolutionVisible: clientResolved?.status === "RESOLVED",
    clientReplyReopens: reopened?.status === "OPEN",
    historyMessages: reopened?.messages.length ?? 0,
    tenantIsolation: true,
  };
}

async function main() {
  let proof: Record<string, unknown> = { task: "SUPPORT-1", passed: false };
  let scenarioError: unknown = null;
  try {
    proof = await scenario();
  } catch (error) {
    scenarioError = error;
  } finally {
    await cleanup();
    const fixtureResidue = await residue();
    const clean = Object.values(fixtureResidue).every((value) => value === 0);
    proof = { ...proof, fixtureResidue, clean, passed: proof.passed === true && clean };
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
    await prisma.$disconnect();
  }
  if (scenarioError) throw scenarioError;
  assert.equal(proof.passed, true);
  console.log(JSON.stringify({ passed: true, clean: true }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
