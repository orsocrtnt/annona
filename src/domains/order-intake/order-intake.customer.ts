import { prisma } from "@/services/prisma/client";
import { normalizePhone, parseSender, type IntakeCustomerMatch } from "./order-intake.draft";

type CustomerDb = Pick<typeof prisma, "user">;
const PHONE_SCAN_LIMIT = 5000;

const displayName = (user: { firstName: string; lastName: string; email: string }) =>
  `${user.firstName} ${user.lastName}`.trim() || user.email;

/**
 * Rapproche l'expéditeur d'un client de l'entreprise de la session, et d'elle seule.
 * Seuls les comptes CLIENT actifs sont candidats (les seuls proposés dans la liste du formulaire) ; deux candidats pour un même numéro ne donnent rien.
 */
export async function matchCustomerBySender(
  companyId: string,
  sender: string | null,
  db: CustomerDb = prisma
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
    // Les numéros sont stockés sous des formats variés : comparaison après normalisation.
    const candidates = await db.user.findMany({
      where: { companyId, role: { systemRole: "CLIENT" }, status: "ACTIVE", phone: { not: null } },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true },
      take: PHONE_SCAN_LIMIT,
    });
    const matches = candidates.filter((user) => normalizePhone(user.phone) === parsed.phone);
    const user = matches.length === 1 ? matches[0] : null;
    return user ? { customerId: user.id, displayName: displayName(user), email: user.email, matchedBy: "phone" } : null;
  }
  return null;
}
