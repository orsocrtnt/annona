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

/** Plusieurs références uniques en une lecture par tour (créations en lot de la démo). */
async function generateUniqueReferences(
  prefix: string,
  count: number,
  taken: (references: string[]) => Promise<string[]>
): Promise<string[]> {
  const result = new Set<string>();
  for (let attempt = 0; attempt < 20 && result.size < count; attempt++) {
    const candidates = new Set<string>();
    while (candidates.size < count - result.size) {
      const reference = `${prefix}-${randomEightDigits()}`;
      if (!result.has(reference)) candidates.add(reference);
    }
    const used = new Set(await taken([...candidates]));
    for (const reference of candidates) if (!used.has(reference)) result.add(reference);
  }
  if (result.size < count) throw new Error("REFERENCE_GENERATION_FAILED");
  return [...result];
}

export async function generateOrderReferences(category: DeliveryCategory, count: number): Promise<string[]> {
  return generateUniqueReferences(ORDER_PREFIX[category], count, async (references) =>
    (await prisma.order.findMany({ where: { reference: { in: references } }, select: { reference: true } }))
      .map((row) => row.reference));
}

export async function generateDeliveryReferences(count: number): Promise<string[]> {
  return generateUniqueReferences("LIV", count, async (references) =>
    (await prisma.delivery.findMany({ where: { reference: { in: references } }, select: { reference: true } }))
      .map((row) => row.reference));
}
