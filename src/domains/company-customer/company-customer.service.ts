import { prisma } from "@/services/prisma/client";
import { createClientOrder } from "@/domains/order/order.service";
import { assertDeliveryCategoryEnabled } from "@/domains/company/company-settings.service";
import {
  prepareStaffOrderInput,
  staffOrderRefusal,
  type CreateOrderForCustomerResult,
} from "@/domains/order/staff-order.service";
import { normalizePhone } from "@/domains/order-intake/order-intake.draft";
import type { CreateClientOrderInput } from "@/lib/validations/order";
import { newCompanyCustomerSchema, type NewCompanyCustomer } from "./company-customer.schema";

export { newCompanyCustomerSchema, type NewCompanyCustomer };

/**
 * MAIL-PONT, étape 4 (option B du 3 novembre 2026) : fiche d'un client de l'entreprise, sans accès
 * à l'espace client. Propre à chaque entreprise (adresse unique par entreprise seulement), créée
 * dans la transaction de la commande validée par l'équipe, jamais avant le clic.
 */

export type CompanyCustomerChoice =
  | { kind: "existing"; id: string }
  | { kind: "new"; customer: NewCompanyCustomer };

export type CreateOrderForCompanyCustomerResult =
  | CreateOrderForCustomerResult
  | { status: "customer_has_account" };

type CompanyCustomerDb = Pick<typeof prisma, "company" | "user" | "order" | "companyCustomer">;

export type CreateOrderForCompanyCustomerDeps = {
  db?: CompanyCustomerDb;
  createOrder?: typeof createClientOrder;
  assertCategory?: typeof assertDeliveryCategoryEnabled;
};

const REPLAYED = "COMPANY_CUSTOMER_ORDER_REPLAYED";

/** Fiches de l'entreprise de la session, et d'elle seule, pour la liste du formulaire. */
export async function listCompanyCustomers(companyId: string, db: Pick<typeof prisma, "companyCustomer"> = prisma) {
  return db.companyCustomer.findMany({
    where: { companyId },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 500,
    select: { id: true, name: true, email: true, phone: true, userId: true },
  });
}

/**
 * Crée la commande validée par l'équipe pour une fiche client : fiche existante de l'entreprise,
 * ou nouvelle fiche créée dans la même transaction. Une adresse déjà connue réutilise sa fiche ;
 * une adresse qui a un compte client dans l'entreprise est refusée (choisir ce compte).
 * Même idempotence que le formulaire : un double clic ou une reprise rend la même commande.
 */
export async function createOrderForCompanyCustomer(
  input: { companyId: string; customer: CompanyCustomerChoice; order: CreateClientOrderInput; idempotencyKey: string },
  deps: CreateOrderForCompanyCustomerDeps = {}
): Promise<CreateOrderForCompanyCustomerResult> {
  const db = deps.db ?? prisma;
  const createOrder = deps.createOrder ?? createClientOrder;
  const assertCategory = deps.assertCategory ?? assertDeliveryCategoryEnabled;
  const { companyId, idempotencyKey } = input;

  let fiche: { id: string; email: string } | null;
  let toCreate: NewCompanyCustomer | null = null;
  if (input.customer.kind === "existing") {
    fiche = await db.companyCustomer.findFirst({ where: { id: input.customer.id, companyId }, select: { id: true, email: true } });
    if (!fiche) return { status: "customer_not_found" };
  } else {
    const parsed = newCompanyCustomerSchema.safeParse(input.customer.customer);
    if (!parsed.success) return { status: "customer_not_found" };
    toCreate = { ...parsed.data, phone: normalizePhone(parsed.data.phone) ?? (parsed.data.phone || null) };
    const account = await db.user.findFirst({
      where: { companyId, email: { equals: toCreate.email, mode: "insensitive" }, role: { systemRole: "CLIENT" } },
      select: { id: true },
    });
    if (account) return { status: "customer_has_account" };
    fiche = await db.companyCustomer.findFirst({ where: { companyId, email: toCreate.email }, select: { id: true, email: true } });
  }
  const email = fiche?.email ?? toCreate!.email;

  // Une clé déjà utilisée dans l'entreprise pour un autre client (compte ou autre fiche) signale
  // un premier essai abouti suivi d'un changement de client : refus, comme pour un compte client.
  const previous = await db.order.findFirst({
    where: { companyId, idempotencyKey },
    select: { customerId: true, companyCustomerId: true },
  });
  if (previous && (previous.customerId !== null || !fiche || previous.companyCustomerId !== fiche.id)) return { status: "conflict" };

  const prepared = await prepareStaffOrderInput(companyId, input.order, { db, assertCategory });
  if (!prepared.ok) return prepared.result;

  let ficheId = fiche?.id ?? null;
  let replayed: { id: string; reference: string } | null = null;
  try {
    const order = await createOrder(null, companyId, email, prepared.order, {
      idempotencyKey,
      // Sans compte, la contrainte (client, clé) ne joue pas : verrou (entreprise, clé) et relecture.
      beforeCreate: async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${companyId}::text || ':' || ${idempotencyKey}::text, 0))`;
        if (toCreate) {
          const created = await tx.companyCustomer.upsert({
            where: { companyId_email: { companyId, email: toCreate.email } },
            create: { companyId, name: toCreate.name, email: toCreate.email, phone: toCreate.phone ?? null },
            update: {},
            select: { id: true },
          });
          ficheId = created.id;
        }
        const winner = await tx.order.findFirst({
          where: { companyId, idempotencyKey },
          select: { id: true, reference: true, customerId: true, companyCustomerId: true },
        });
        if (!winner) return;
        if (winner.customerId === null && winner.companyCustomerId === ficheId) {
          replayed = { id: winner.id, reference: winner.reference };
          throw new Error(REPLAYED);
        }
        throw new Error("IDEMPOTENCY_KEY_REUSED");
      },
      afterCreate: async (tx, created) => {
        await tx.order.update({ where: { id: created.id }, data: { companyCustomerId: ficheId } });
      },
    });
    return { status: "created", order: { id: order.id, reference: (order as { reference?: string }).reference } };
  } catch (error) {
    const done = replayed as { id: string; reference: string } | null;
    if (error instanceof Error && error.message === REPLAYED && done) return { status: "created", order: done };
    return staffOrderRefusal(error);
  }
}

