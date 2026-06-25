import type { DeliveryCategory } from "@prisma/client";
import { prisma } from "@/services/prisma/client";

const ORDER_PREFIX: Record<DeliveryCategory, string> = {
  STANDARD: "CMD",
  COURIER: "CRS",
  SPECIAL_MISSION: "MIS",
};

function randomEightDigits(): string {
  return String(Math.floor(10_000_000 + Math.random() * 90_000_000));
}

async function generateUniqueReference(
  prefix: string,
  exists: (reference: string) => Promise<boolean>
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const reference = `${prefix}-${randomEightDigits()}`;
    if (!(await exists(reference))) return reference;
  }
  throw new Error("REFERENCE_GENERATION_FAILED");
}

export async function generateOrderReference(
  category: DeliveryCategory = "STANDARD"
): Promise<string> {
  const prefix = ORDER_PREFIX[category];
  return generateUniqueReference(prefix, async (reference) => {
    const existing = await prisma.order.findUnique({
      where: { reference },
      select: { id: true },
    });
    return !!existing;
  });
}

export async function generateDeliveryReference(): Promise<string> {
  return generateUniqueReference("LIV", async (reference) => {
    const existing = await prisma.delivery.findUnique({
      where: { reference },
      select: { id: true },
    });
    return !!existing;
  });
}
