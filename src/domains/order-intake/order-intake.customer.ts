import { prisma } from "@/services/prisma/client";
import { parseSender, type IntakeCustomerMatch } from "./order-intake.draft";

type CustomerDb = Pick<typeof prisma, "user" | "$queryRaw" | "companyCustomer">;

const displayName = (user: { firstName: string; lastName: string; email: string }) =>
  `${user.firstName} ${user.lastName}`.trim() || user.email;

/**
 * Rapproche l'expéditeur d'un client de l'entreprise de la session, et d'elle seule.
 * Seuls les comptes CLIENT actifs sont candidats (les seuls proposés dans la liste du formulaire) ;
 * deux candidats pour un même numéro ne donnent rien. Sans compte, la fiche client sans accès de
 * l'entreprise (MAIL-PONT, étape 4) est proposée.
 */
export async function matchCustomerBySender(
  companyId: string,
  sender: string | null,
  db: CustomerDb = prisma
): Promise<IntakeCustomerMatch | null> {
  const account = await matchAccountBySender(companyId, sender, db);
  if (account) return { kind: "user", ...account };
  const parsed = parseSender(sender);
  if (!parsed.email && !parsed.phone) return null;
  const cards = await db.companyCustomer.findMany({
    where: { companyId, ...(parsed.email ? { email: parsed.email } : { phone: parsed.phone }) },
    orderBy: { id: "asc" },
    take: 2,
    select: { id: true, name: true, email: true },
  });
  if (cards.length !== 1) return null;
  const card = cards[0]!;
  return { kind: "card", customerId: card.id, displayName: card.name || card.email, email: card.email, matchedBy: parsed.email ? "email" : "phone" };
}

async function matchAccountBySender(
  companyId: string,
  sender: string | null,
  db: CustomerDb
): Promise<IntakeCustomerMatch | null> {
  const parsed = parseSender(sender);
  if (parsed.email) {
    const user = await db.user.findFirst({
      where: {
        companyId,
        role: { systemRole: "CLIENT" },
        status: "ACTIVE",
        email: { equals: parsed.email, mode: "insensitive" },
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    return user ? { customerId: user.id, displayName: displayName(user), email: user.email, matchedBy: "email" } : null;
  }
  if (parsed.phone) {
    // Numéros stockés sous des formats variés : la base applique la même normalisation que
    // normalizePhone (chiffres et +, +33 ou 0033 deviennent 0, puis chiffres seuls). Requête
    // paramétrée, triée et limitée à deux lignes : résultat déterministe, ambiguïté détectée.
    const rows = await db.$queryRaw<Array<{ id: string }>>`
      SELECT u."id"
      FROM "users" u
      JOIN "roles" r ON r."id" = u."role_id"
      WHERE u."company_id" = ${companyId}
        AND r."system_role" = 'CLIENT'
        AND u."status" = 'ACTIVE'
        AND u."phone" IS NOT NULL
        AND regexp_replace(regexp_replace(regexp_replace(u."phone", '[^0-9+]', '', 'g'), '^([+]33|0033)', '0'), '[^0-9]', '', 'g') = ${parsed.phone}
      ORDER BY u."id"
      LIMIT 2`;
    if (rows.length !== 1) return null;
    const user = await db.user.findFirst({
      where: { id: rows[0]!.id, companyId, role: { systemRole: "CLIENT" }, status: "ACTIVE" },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    return user ? { customerId: user.id, displayName: displayName(user), email: user.email, matchedBy: "phone" } : null;
  }
  return null;
}
