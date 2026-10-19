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
  companyId: string
): Promise<T[]> {
  const orphanEmails = [
    ...new Set(
      rows
        .filter((row) => !row.customer && row.customerEmail)
        .map((row) => row.customerEmail as string)
    ),
  ];

  if (orphanEmails.length === 0) return rows;

  const usersByEmail = await prisma.user.findMany({
    where: { email: { in: orphanEmails }, companyId },
    select: { email: true, firstName: true, lastName: true },
  });
  const emailToUser = new Map(usersByEmail.map((user) => [user.email, user]));

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
