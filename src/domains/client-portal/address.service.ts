import { prisma } from "@/services/prisma/client";
import type { CustomerAddressInput } from "@/lib/validations/address";
import { CLIENT_ADDRESSES_TAKE } from "@/lib/query/list-limits";

export async function getClientAddresses(userId: string) {
  return prisma.customerAddress.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    take: CLIENT_ADDRESSES_TAKE,
  });
}

export async function createClientAddress(userId: string, input: CustomerAddressInput) {
  if (input.isDefault) {
    await prisma.customerAddress.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  const count = await prisma.customerAddress.count({ where: { userId } });

  return prisma.customerAddress.create({
    data: {
      ...input,
      userId,
      isDefault: input.isDefault ?? count === 0,
    },
  });
}

export async function updateClientAddress(
  userId: string,
  addressId: string,
  input: Partial<CustomerAddressInput>
) {
  const existing = await prisma.customerAddress.findFirst({
    where: { id: addressId, userId },
  });
  if (!existing) return null;

  if (input.isDefault) {
    await prisma.customerAddress.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  return prisma.customerAddress.update({
    where: { id: addressId },
    data: input,
  });
}

export async function deleteClientAddress(userId: string, addressId: string) {
  const existing = await prisma.customerAddress.findFirst({
    where: { id: addressId, userId },
  });
  if (!existing) return false;

  await prisma.customerAddress.delete({ where: { id: addressId } });

  if (existing.isDefault) {
    const next = await prisma.customerAddress.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (next) {
      await prisma.customerAddress.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  return true;
}
