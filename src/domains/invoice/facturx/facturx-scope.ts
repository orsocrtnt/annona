/** Filtres d'isolation multi-entreprise pour Factur-X (purs, testables sans base). */
import type { Prisma } from "@prisma/client";

export interface FacturXInvoiceScope {
  invoiceId: string;
  companyId: string;
  /** Portail : seule une facture du commerçant que représente l'utilisateur connecté est lisible. */
  customerId?: string;
}

/** L'entreprise de la session est toujours imposée ; le commerçant du client aussi côté portail. */
export function facturXInvoiceWhere(scope: FacturXInvoiceScope): Prisma.InvoiceWhereInput {
  if (!scope.companyId || !scope.invoiceId) throw new Error("FACTURX_SCOPE_REQUIRED");
  if (scope.customerId !== undefined && !scope.customerId) throw new Error("FACTURX_SCOPE_REQUIRED");
  return {
    id: scope.invoiceId,
    companyId: scope.companyId,
    ...(scope.customerId !== undefined
      ? { merchant: { is: { companyId: scope.companyId, users: { some: { id: scope.customerId, companyId: scope.companyId } } } } }
      : {}),
  };
}
