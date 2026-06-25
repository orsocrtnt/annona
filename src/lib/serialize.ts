/** Sérialise les objets Prisma (Date, Decimal) pour les props Server → Client */
export function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}
