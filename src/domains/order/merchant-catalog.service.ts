/**
 * Catalogue vu par le client (CLI-03) et son profil (CLI-02). Catégories et produits actifs de son
 * entreprise, dans l'ordre du back-office, au prix appliqué pour son commerce (RG-05, critère 3).
 */
import { prisma } from "@/services/prisma/client";
import { applyPrices } from "@/domains/catalog/pricing";
import { photoVersion } from "@/domains/catalog/catalog.service";
import type { MerchantRef } from "@/domains/order/merchant-order.service";
import { slotLabel } from "@/domains/order/merchant-order.service";
import type { PortalCatalog, PortalMerchantProfile } from "@/domains/order/merchant-order.types";
import { companyToday, firstOpenDeliveryDate } from "@/domains/order/order-deadline";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { isProductPhotoPath } from "@/lib/storage/product-photo";

export async function getMerchantCatalog(actor: MerchantRef, now = new Date()): Promise<PortalCatalog> {
  const [company, categories, slots, specificPrices] = await Promise.all([
    prisma.company.findUnique({ where: { id: actor.companyId }, select: { cutoffTime: true, timezone: true } }),
    prisma.category.findMany({
      where: { companyId: actor.companyId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        products: {
          where: { companyId: actor.companyId, active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, description: true, unit: true, photoUrl: true, basePriceCents: true, vatRateBasisPoints: true },
        },
      },
    }),
    prisma.slot.findMany({
      where: { companyId: actor.companyId, active: true },
      orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }],
      select: { id: true, label: true, startTime: true, endTime: true },
    }),
    prisma.merchantPrice.findMany({
      where: { companyId: actor.companyId, merchantId: actor.merchantId },
      select: { productId: true, priceCents: true },
    }),
  ]);
  if (!company) throw new DomainRuleError(404, "Entreprise introuvable.", "COMPANY_NOT_FOUND");

  const prices = applyPrices(categories.flatMap((category) => category.products), specificPrices);
  return {
    categories: categories
      .filter((category) => category.products.length > 0)
      .map((category) => ({
        id: category.id,
        name: category.name,
        products: category.products.map((product) => {
          const price = prices.get(product.id)!;
          return {
            id: product.id,
            name: product.name,
            description: product.description,
            unit: product.unit,
            photoVersion: isProductPhotoPath(product.photoUrl, actor.companyId) ? photoVersion(product.photoUrl!) : null,
            unitPriceCents: price.unitPriceCents,
            vatRateBasisPoints: price.vatRateBasisPoints,
            isSpecific: price.isSpecific,
          };
        }),
      })),
    slots: slots.map((slot) => ({ id: slot.id, label: slotLabel(slot), startTime: slot.startTime, endTime: slot.endTime })),
    rules: {
      today: companyToday(now, company.timezone),
      firstOpenDate: firstOpenDeliveryDate(now, company.cutoffTime, company.timezone),
      cutoffTime: company.cutoffTime,
      timeZone: company.timezone,
    },
  };
}

/** CLI-02 : fiche du commerce du client (lecture seule ; tenue par la boulangerie). */
export async function getMerchantProfile(actor: MerchantRef): Promise<PortalMerchantProfile> {
  const merchant = await prisma.merchant.findFirst({
    where: { id: actor.merchantId, companyId: actor.companyId },
    select: {
      name: true,
      tradeName: true,
      address: true,
      postalCode: true,
      city: true,
      accessInstructions: true,
      contactName: true,
      contactPhone: true,
      contactEmail: true,
      billingEmail: true,
      billingAddress: true,
      billingPostalCode: true,
      billingCity: true,
      billingPeriod: true,
      paymentMethod: true,
      siren: true,
      vatNumber: true,
    },
  });
  if (!merchant) throw new DomainRuleError(404, "Commerce introuvable.", "MERCHANT_NOT_FOUND");
  return merchant;
}
