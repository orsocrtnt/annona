/**
 * DEMO-1 — écrit en base la journée de démo d'un environnement (`buildDemoScenario`), remise à l'heure du moment.
 *
 * L'environnement précédent est effacé en entier (son entreprise et tout ce qui en dépend, ses comptes), puis la
 * journée est réécrite dans une seule transaction : un visiteur ne voit jamais un environnement à moitié écrit.
 * Les comptes de connexion Supabase sont créés une fois (adresse `@demo.annona.example`, mot de passe aléatoire jamais
 * affiché) et réutilisés à chaque reconstruction : on n'y entre que par la page /demo, avec le cookie de prêt.
 */
import { randomBytes } from "node:crypto";
import type { Prisma, SystemRole } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { createAdminClient } from "@/services/supabase/admin";
import { buildDemoScenario, type DemoScenario } from "@/domains/demo/demo-scenario";

/** Lignes par insertion : sous la limite de 65 535 paramètres de Postgres, même pour les tables larges. */
const CHUNK = 1_500;
const TRANSACTION_TIMEOUT_MS = 120_000;

type AuthAdmin = ReturnType<typeof createAdminClient>["auth"]["admin"];

/** Compte Supabase d'une adresse de démo : créé confirmé s'il manque, sinon retrouvé (lien généré sans envoi). */
export async function ensureDemoAuthUser(admin: AuthAdmin, email: string, known?: string): Promise<string> {
  if (known) return known;
  const created = await admin.createUser({
    email,
    email_confirm: true,
    password: randomBytes(24).toString("base64url"),
    user_metadata: { demo: true },
  });
  if (created.data.user) return created.data.user.id;
  // Déjà inscrit (reconstruction après une coupure) : `generateLink` renvoie le compte sans rien envoyer.
  const link = await admin.generateLink({ type: "magiclink", email });
  if (link.data.user) return link.data.user.id;
  throw new Error(`Compte de démo introuvable (${email}) : ${created.error?.message ?? link.error?.message ?? "inconnu"}`);
}

async function insertChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await insert(rows.slice(i, i + CHUNK));
}

/** Rôle système de chaque `SystemRole` utilisé par la démo (créés par le seed de référence). */
async function systemRoleIds(roles: SystemRole[]): Promise<Map<SystemRole, string>> {
  const found = await prisma.role.findMany({
    where: { systemRole: { in: roles }, isSystem: true },
    select: { id: true, systemRole: true },
    orderBy: { createdAt: "asc" },
  });
  const map = new Map<SystemRole, string>();
  for (const role of found) if (!map.has(role.systemRole)) map.set(role.systemRole, role.id);
  for (const role of roles) if (!map.has(role)) throw new Error(`Rôle système absent : ${role} (seed de référence non appliqué ?)`);
  return map;
}

/** Écrit le scénario ; l'entreprise et les comptes de l'environnement sont d'abord effacés. */
async function writeScenario(scenario: DemoScenario, authIds: Map<string, string>, roleIds: Map<SystemRole, string>) {
  const emails = scenario.users.map((user) => user.email);
  await prisma.$transaction(
    async (tx) => {
      await tx.company.deleteMany({ where: { id: scenario.companyId } });
      await tx.user.deleteMany({ where: { OR: [{ companyId: scenario.companyId }, { email: { in: emails } }] } });

      await tx.company.createMany({ data: [scenario.company] });
      await tx.category.createMany({ data: scenario.categories });
      await insertChunks(scenario.products, (data) => tx.product.createMany({ data }));
      await tx.deliveryZone.createMany({ data: scenario.zones });
      await tx.slot.createMany({ data: scenario.slots });
      await insertChunks(scenario.merchants, (data) => tx.merchant.createMany({ data }));
      await insertChunks(scenario.merchantPrices, (data) => tx.merchantPrice.createMany({ data }));
      const users: Prisma.UserCreateManyInput[] = scenario.users.map((user) => ({
        id: user.id,
        authId: authIds.get(user.email)!,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        status: "ACTIVE",
        companyId: scenario.companyId,
        roleId: roleIds.get(user.role)!,
        merchantId: user.merchantId,
        settings: { demo: true },
      }));
      await tx.user.createMany({ data: users });
      await tx.recurringOrder.createMany({ data: scenario.recurringOrders });
      await insertChunks(scenario.recurringOrderLines, (data) => tx.recurringOrderLine.createMany({ data }));
      await insertChunks(scenario.orders, (data) => tx.order.createMany({ data }));
      await insertChunks(scenario.orderLines, (data) => tx.orderLine.createMany({ data }));
      await insertChunks(scenario.rounds, (data) => tx.round.createMany({ data }));
      await insertChunks(scenario.stops, (data) => tx.stop.createMany({ data }));
    },
    { timeout: TRANSACTION_TIMEOUT_MS, maxWait: 10_000 },
  );
}

/**
 * Reconstruit l'environnement `slot` pour la journée de `now`. Renvoie l'identifiant de son entreprise.
 * L'appelant tient l'environnement (état PREPARING) : aucun autre visiteur ne peut l'utiliser pendant ce temps.
 */
export async function provisionDemoEnvironment(slot: number, now = new Date()): Promise<{ companyId: string; ms: number }> {
  const started = Date.now();
  const scenario = buildDemoScenario({ slot, now });
  const emails = scenario.users.map((user) => user.email);

  // Comptes Supabase réutilisés : l'adresse est stable d'une reconstruction à l'autre.
  const existing = await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true, authId: true } });
  const known = new Map(existing.map((user) => [user.email, user.authId]));
  const admin = createAdminClient().auth.admin;
  const authIds = new Map<string, string>();
  for (const email of emails) authIds.set(email, await ensureDemoAuthUser(admin, email, known.get(email)));

  const roleIds = await systemRoleIds([...new Set(scenario.users.map((user) => user.role))]);
  await writeScenario(scenario, authIds, roleIds);
  return { companyId: scenario.companyId, ms: Date.now() - started };
}
