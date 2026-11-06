import "server-only";
import type { MerchantActor } from "@/lib/api/tenant-auth";
import type { MerchantRef } from "@/domains/order/merchant-order.service";

/** Référence du client connecté (entreprise, commerce, utilisateur), toujours issue de la session. */
export function merchantRef(actor: MerchantActor): MerchantRef {
  return { companyId: actor.companyId, merchantId: actor.merchantId, userId: actor.user.id };
}
