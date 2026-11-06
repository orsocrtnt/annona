import { z } from "zod";

export const invoiceGeneralSettingsSchema = z.object({
  vatRate: z.number().min(0).max(100),
  defaultDueDays: z.number().int().min(1).max(365),
  referencePrefix: z.string().max(20),
  footerNote: z.string().max(500),
  /** DEMO-3 : émettre la facture automatiquement au passage en « Livrée ». Désactivé par défaut. */
  autoInvoiceOnDelivery: z.boolean().default(false),
});

export const companyBillingSettingsSchema = z.object({
  invoice: invoiceGeneralSettingsSchema,
});

export type InvoiceGeneralSettings = z.infer<typeof invoiceGeneralSettingsSchema>;
export type CompanyBillingSettings = z.infer<typeof companyBillingSettingsSchema>;

export const DEFAULT_INVOICE_GENERAL: InvoiceGeneralSettings = {
  vatRate: 20,
  defaultDueDays: 30,
  referencePrefix: "FAC",
  footerNote: "",
  autoInvoiceOnDelivery: false,
};

export const DEFAULT_BILLING_SETTINGS: CompanyBillingSettings = {
  invoice: DEFAULT_INVOICE_GENERAL,
};
