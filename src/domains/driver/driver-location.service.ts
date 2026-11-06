import { OrderAccessError, serializableTransaction } from "@/domains/order/order-access";
import type { UpdateDriverLocationInput } from "@/lib/validations/driver-location";

/**
 * Position du livreur, enregistrée seulement pendant une tournée démarrée (ENF-04) : sans tournée
 * IN_PROGRESS qui lui est attribuée dans son entreprise, rien n'est écrit.
 */
export async function upsertDriverLocation(driverId: string, companyId: string, data: UpdateDriverLocationInput) {
  return serializableTransaction(async (tx) => {
    const driver = await tx.user.findFirst({
      where: { id: driverId, companyId, status: "ACTIVE", role: { systemRole: "DRIVER" } },
      select: { id: true },
    });
    if (!driver) throw new OrderAccessError(403, "Livreur introuvable.");
    const round = await tx.round.findFirst({
      where: { driverId, companyId, status: "IN_PROGRESS" },
      select: { id: true },
    });
    if (!round) throw new OrderAccessError(409, "Aucune tournée démarrée : position non enregistrée.");
    return tx.driverLocation.upsert({
      where: { driverId },
      create: { driverId, companyId, ...data },
      update: { ...data, companyId },
    });
  });
}
