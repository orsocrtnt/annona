import { prisma } from "@/services/prisma/client";

type CustomerSummary = {
  firstName: string;
  lastName: string;
  email: string;
};

type WithCustomerEmail = {
  customerEmail: string | null;
  customer: CustomerSummary | null;
};

export async function resolveCustomersByEmail<T extends WithCustomerEmail>(
  rows: T[],
  companyId: string,
  db: Pick<typeof prisma, "user" | "companyCustomer"> = prisma
): Promise<T[]> {
  const orphanEmails = [
    ...new Set(
      rows
        .filter((row) => !row.customer && row.customerEmail)
        .map((row) => row.customerEmail as string)
    ),
  ];

  if (orphanEmails.length === 0) return rows;

  const usersByEmail = await db.user.findMany({
    where: { email: { in: orphanEmails }, companyId },
    select: { email: true, firstName: true, lastName: true },
  });
  const emailToUser = new Map(usersByEmail.map((user) => [user.email, user]));
  // MAIL-PONT, étape 4 : sans compte, le nom vient de la fiche client sans accès de l'entreprise.
  const withoutAccount = orphanEmails.filter((email) => !emailToUser.has(email));
  if (withoutAccount.length > 0) {
    const cards = await db.companyCustomer.findMany({
      where: { companyId, email: { in: withoutAccount.map((email) => email.toLowerCase()) } },
      select: { email: true, name: true },
    });
    for (const email of withoutAccount) {
      const card = cards.find((candidate) => candidate.email === email.toLowerCase());
      if (card) emailToUser.set(email, { email, firstName: card.name, lastName: "" });
    }
  }

  return rows.map((row) => {
    if (row.customer || !row.customerEmail) return row;
    const user = emailToUser.get(row.customerEmail);
    if (!user) return row;
    return {
      ...row,
      customer: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: row.customerEmail,
      },
    };
  });
}
