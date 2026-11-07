/**
 * Accès base pour Factur-X : chargement d'une facture strictement limitée à l'entreprise
 * (et au commerçant du client côté portail), lecture/écriture des mentions légales de
 * l'entreprise (JSON `settings`). L'identité de facturation de l'acheteur vient de la fiche `Merchant`.
 */
import { Prisma } from "@prisma/client";
import type { FacturXSource } from "@/domains/invoice/facturx/facturx-mapping";
import { facturXInvoiceWhere, type FacturXInvoiceScope } from "@/domains/invoice/facturx/facturx-scope";
import { parseBillingSettings } from "@/domains/company/billing-settings.service";
import { readCompanyLogo } from "@/domains/company/company-logo.service";
import { dbDateKey, periodRangeLabel, periodShortLabel } from "@/domains/invoice/billing-period";
import { vatOf } from "@/domains/invoice/invoice-builder";
import { invoiceLegalMentions } from "@/domains/invoice/invoice-legal";
import { settlementStatus } from "@/domains/invoice/invoice-settlement";
import { SETTLEMENT_LABELS } from "@/lib/constants/invoice-status";
import { generateInvoicePdf, type InvoicePdfData, type InvoicePdfLegalMentions } from "@/lib/pdf/invoice-pdf";
import {
  clientInvoiceIdentitySchema,
  parseStoredEinvoicingSettings,
  type CompanyEinvoicingUpdate,
} from "@/lib/validations/einvoicing";
import { settingsSection, updateSettingsWithClaim } from "@/lib/database/claimed-settings-update";
import { prisma } from "@/services/prisma/client";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export interface LoadedFacturXInvoice {
  companyId: string;
  reference: string;
  /** Toujours présent : une facture de période a toujours un commerçant (relation obligatoire). */
  source: FacturXSource | null;
  pdf: Omit<InvoicePdfData, "companyLogoPng" | "legal">;
  /**
   * FACT-1 (ENF-05) : mentions légales visibles du PDF de facture, construites depuis les paramètres de
   * l'entreprise sans rien inventer ; les manques sont signalés à l'administrateur (invoice-legal.ts).
   */
  legal?: InvoicePdfLegalMentions;
}

const vatLabel = (basisPoints: number) => `${(basisPoints / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export async function loadFacturXInvoice(scope: FacturXInvoiceScope): Promise<LoadedFacturXInvoice | null> {
  const invoice = await prisma.invoice.findFirst({
    where: facturXInvoiceWhere(scope),
    select: {
      reference: true,
      status: true,
      issuedAt: true,
      dueDate: true,
      paidAt: true,
      periodType: true,
      periodStart: true,
      periodEnd: true,
      subtotalCents: true,
      vatCents: true,
      totalCents: true,
      notes: true,
      companyId: true,
      lines: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { label: true, unit: true, quantity: true, unitPriceCents: true, vatRateBasisPoints: true, totalCents: true },
      },
      // Livraisons regroupées (RG-06) : date, référence et montant HT livré.
      orders: {
        where: { status: "DELIVERED" },
        orderBy: [{ deliveryDate: "asc" }, { reference: "asc" }],
        select: {
          reference: true,
          deliveryDate: true,
          lines: { select: { quantityOrdered: true, quantityDelivered: true, unitPriceFrozenCents: true } },
        },
      },
      payments: { select: { amountCents: true } },
      company: {
        select: {
          name: true,
          legalName: true,
          siren: true,
          siret: true,
          email: true,
          address: true,
          city: true,
          country: true,
          billingAddress: true,
          billingPostalCode: true,
          billingCity: true,
          settings: true,
        },
      },
      merchant: {
        select: {
          name: true,
          tradeName: true,
          siren: true,
          vatNumber: true,
          address: true,
          postalCode: true,
          city: true,
          billingAddress: true,
          billingPostalCode: true,
          billingCity: true,
          billingEmail: true,
          contactEmail: true,
        },
      },
    },
  });
  if (!invoice) return null;

  const company = invoice.company;
  const merchant = invoice.merchant;
  const storedEinvoicing = parseStoredEinvoicingSettings(asRecord(company.settings).einvoicing);
  const buyerEmail = merchant.billingEmail ?? merchant.contactEmail ?? null;
  const identity = clientInvoiceIdentitySchema.safeParse({
    companyName: merchant.name,
    siren: merchant.siren ?? undefined,
    vatNumber: merchant.vatNumber ?? undefined,
    address: merchant.billingAddress ?? merchant.address,
    postalCode: merchant.billingPostalCode ?? merchant.postalCode ?? "",
    city: merchant.billingCity ?? merchant.city ?? "",
    countryCode: "FR",
  });
  // TVA par taux, sur le cumul HT du taux (même calcul que la génération et le Factur-X).
  const vatByRate = new Map<number, number>();
  for (const line of invoice.lines) {
    vatByRate.set(line.vatRateBasisPoints, (vatByRate.get(line.vatRateBasisPoints) ?? 0) + line.totalCents);
  }
  const paidCents = Math.min(invoice.totalCents, invoice.payments.reduce((sum, payment) => sum + payment.amountCents, 0));
  const period = { type: invoice.periodType, start: dbDateKey(invoice.periodStart), end: dbDateKey(invoice.periodEnd) };
  const settlement = invoice.status === "CANCELLED" ? null : settlementStatus(invoice.totalCents, paidCents);
  const lastDelivery = invoice.orders.at(-1)?.deliveryDate ?? null;
  const hasExempt = invoice.lines.some((line) => line.vatRateBasisPoints === 0);
  const seller = {
    name: company.name,
    legalName: company.legalName,
    siren: company.siren,
    siret: company.siret,
    email: company.email,
    billingAddress: company.billingAddress,
    billingPostalCode: company.billingPostalCode,
    billingCity: company.billingCity,
    country: company.country,
  };

  return {
    companyId: invoice.companyId,
    reference: invoice.reference,
    source: {
      invoice: {
        reference: invoice.reference,
        status: invoice.status,
        createdAt: invoice.issuedAt,
        dueDate: invoice.dueDate,
        lines: invoice.lines.map(({ label, quantity, unitPriceCents, vatRateBasisPoints }) => ({ label, quantity, unitPriceCents, vatRateBasisPoints })),
        subtotalCents: invoice.subtotalCents,
        vatCents: invoice.vatCents,
        totalCents: invoice.totalCents,
        paidCents,
        notes: invoice.notes,
        orderReference: null,
        deliveryDate: lastDelivery ?? invoice.periodEnd,
      },
      seller,
      einvoicing: storedEinvoicing.settings,
      einvoicingInvalidFields: storedEinvoicing.invalidFields,
      buyer: {
        firstName: merchant.name,
        lastName: "",
        email: buyerEmail,
        identity: identity.success ? identity.data : null,
        defaultAddress: { address: merchant.address, postalCode: merchant.postalCode, city: merchant.city },
      },
    },
    // Facture PDF : lignes HT (unité et taux en détail), puis HT, TVA par taux, TTC et déjà réglé.
    pdf: {
      reference: invoice.reference,
      status: invoice.status,
      statusLabel: settlement ? SETTLEMENT_LABELS[settlement] : null,
      createdAt: invoice.issuedAt,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      amount: invoice.totalCents / 100,
      period: periodShortLabel(period),
      lineItems: invoice.lines.map((line) => ({
        label: line.label,
        amount: line.unitPriceCents / 100,
        quantity: line.quantity,
        detail: [line.unit, `TVA ${vatLabel(line.vatRateBasisPoints)}`].filter(Boolean).join(" · "),
      })),
      totals: {
        subtotal: invoice.subtotalCents / 100,
        vat: [...vatByRate.entries()]
          .sort(([a], [b]) => a - b)
          .map(([rate, basis]) => ({ label: `TVA ${vatLabel(rate)} sur ${euros.format(basis / 100)}`, amount: vatOf(basis, rate) / 100 })),
        total: invoice.totalCents / 100,
        paid: paidCents / 100,
      },
      orders: invoice.orders.map((order) => ({
        reference: order.reference,
        date: shortDate.format(order.deliveryDate),
        amount: order.lines.reduce((sum, line) => sum + (line.quantityDelivered ?? line.quantityOrdered) * (line.unitPriceFrozenCents ?? 0), 0) / 100,
        shortage: order.lines.some((line) => line.quantityDelivered !== null && line.quantityDelivered < line.quantityOrdered),
      })),
      notes: invoice.notes,
      orderReference: null,
      company: { name: company.legalName || company.name, email: company.email, address: company.address, city: company.city },
      customerName: merchant.tradeName || merchant.name,
      customerEmail: buyerEmail,
      // Pied de page lu dans les réglages déjà chargés : pas de seconde lecture de Company.settings.
      footerNote: parseBillingSettings(asRecord(company.settings).billing).invoice.footerNote || null,
    },
    legal: invoiceLegalMentions({
      seller,
      einvoicing: storedEinvoicing.settings,
      buyer: {
        name: merchant.name,
        siren: merchant.siren,
        vatNumber: merchant.vatNumber,
        address: merchant.billingAddress ?? merchant.address,
        postalCode: merchant.billingPostalCode ?? merchant.postalCode,
        city: merchant.billingCity ?? merchant.city,
      },
      dueDate: invoice.dueDate,
      periodSentence: periodRangeLabel(period),
      hasExempt,
    }),
  };
}

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/**
 * PDF de la facture, avec le même logo et le même pied de page partout (back-office, portail, e-mail).
 * `legal` (variante Factur-X) remplace les mentions visibles par celles portées par le XML ; sans
 * paramètre, les mentions légales de la facture (`loaded.legal`) sont utilisées.
 */
export async function renderClassicInvoicePdf(loaded: LoadedFacturXInvoice, legal?: InvoicePdfLegalMentions): Promise<Uint8Array> {
  // Un logo absent ou illisible ne bloque jamais le relevé.
  const companyLogoPng = await readCompanyLogo(loaded.companyId).catch(() => null);
  return generateInvoicePdf({ ...loaded.pdf, companyLogoPng, legal: legal ?? loaded.legal });
}

// ---------------------------------------------------------------------------
// Mentions légales de l'entreprise (administrateur uniquement, voir la route)
// ---------------------------------------------------------------------------

export async function getCompanyEinvoicing(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      legalName: true,
      siren: true,
      siret: true,
      billingAddress: true,
      billingPostalCode: true,
      billingCity: true,
      country: true,
      settings: true,
    },
  });
  if (!company) return null;
  const { settings, ...identity } = company;
  const stored = parseStoredEinvoicingSettings(asRecord(settings).einvoicing);
  return { identity: { ...identity, country: identity.country ?? "FR" }, einvoicing: stored.settings, invalidFields: stored.invalidFields };
}

export async function updateCompanyEinvoicing(companyId: string, input: CompanyEinvoicingUpdate) {
  const identity = input.identity;
  // Réclamation sur updatedAt : une écriture concurrente de settings (billing…) n'est jamais écrasée.
  const result = await updateSettingsWithClaim({
    load: () => prisma.company.findUnique({ where: { id: companyId }, select: { settings: true, updatedAt: true } }),
    apply: (current) => ({ ...current, einvoicing: input.einvoicing }),
    section: settingsSection("einvoicing"),
    save: async (settings, claim) => {
      try {
        const claimed = await prisma.company.updateMany({
          where: { id: companyId, updatedAt: claim.expected },
          data: {
            legalName: identity.legalName ?? null,
            siren: identity.siren ?? null,
            siret: identity.siret ?? null,
            billingAddress: identity.billingAddress ?? null,
            billingPostalCode: identity.billingPostalCode ?? null,
            billingCity: identity.billingCity ?? null,
            country: identity.country,
            settings: settings as Prisma.InputJsonValue,
            updatedAt: claim.next,
          },
        });
        return claimed.count === 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("COMPANY_IDENTITY_TAKEN");
        throw error;
      }
    },
  });
  if (result === "missing") throw new Error("COMPANY_NOT_FOUND");
  return input;
}
