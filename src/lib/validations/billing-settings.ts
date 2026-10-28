import { z } from "zod";

export const courierPricingSettingsSchema = z.object({
  basePrice: z.number().min(0),
  pricePerKm: z.number().min(0),
  minimumPrice: z.number().min(0),
  nightSurchargePercent: z.number().min(0).max(100),
  weekendSurchargePercent: z.number().min(0).max(100),
  freeKmIncluded: z.number().min(0),
  /** Affiche une estimation de prix indicative au client lors d'une commande de course. */
  showClientEstimate: z.boolean().default(false),
});

export const invoiceGeneralSettingsSchema = z.object({
  vatRate: z.number().min(0).max(100),
  defaultDueDays: z.number().int().min(1).max(365),
  referencePrefix: z.string().max(20),
  footerNote: z.string().max(500),
  /** DEMO-3 : émettre la facture automatiquement au passage en « Livrée ». Désactivé par défaut. */
  autoInvoiceOnDelivery: z.boolean().default(false),
});

export const companyBillingSettingsSchema = z.object({
  courier: courierPricingSettingsSchema,
  invoice: invoiceGeneralSettingsSchema,
});

export type CourierPricingSettings = z.infer<typeof courierPricingSettingsSchema>;
export type InvoiceGeneralSettings = z.infer<typeof invoiceGeneralSettingsSchema>;
export type CompanyBillingSettings = z.infer<typeof companyBillingSettingsSchema>;

export const DEFAULT_COURIER_PRICING: CourierPricingSettings = {
  basePrice: 8,
  pricePerKm: 1.2,
  minimumPrice: 10,
  nightSurchargePercent: 0,
  weekendSurchargePercent: 0,
  freeKmIncluded: 0,
  showClientEstimate: false,
};

export const DEFAULT_INVOICE_GENERAL: InvoiceGeneralSettings = {
  vatRate: 20,
  defaultDueDays: 30,
  referencePrefix: "FAC",
  footerNote: "",
  autoInvoiceOnDelivery: false,
};

export const DEFAULT_BILLING_SETTINGS: CompanyBillingSettings = {
  courier: DEFAULT_COURIER_PRICING,
  invoice: DEFAULT_INVOICE_GENERAL,
};
