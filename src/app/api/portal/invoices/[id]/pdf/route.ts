import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { getClientInvoiceById } from "@/domains/invoice/invoice.service";
import { getCompanyBillingSettings } from "@/domains/company/billing-settings.service";
import { readCompanyLogo } from "@/domains/company/company-logo.service";
import { generateInvoicePdf } from "@/lib/pdf/invoice-pdf";
import type { InvoiceLineItem } from "@/lib/validations/invoice";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;
  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
  }

  const { id } = await params;
  const invoice = await getClientInvoiceById(auth.context.user.id, companyId, id);
  if (!invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  const [billing, companyLogoPng] = invoice.companyId
    ? await Promise.all([
        getCompanyBillingSettings(invoice.companyId),
        // Un logo absent ou illisible ne bloque jamais le relevé : le nom s'affiche à la place.
        readCompanyLogo(invoice.companyId).catch(() => null),
      ])
    : [null, null];

  const rawLines = Array.isArray(invoice.lineItems)
    ? (invoice.lineItems as unknown as InvoiceLineItem[])
    : [];

  const user = auth.context.user;
  const pdf = await generateInvoicePdf({
    reference: invoice.reference,
    status: invoice.status,
    createdAt: invoice.createdAt,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    amount: Number(invoice.amount),
    lineItems: rawLines.map((l) => ({
      label: l.label,
      amount: l.amount,
      quantity: l.quantity,
    })),
    notes: invoice.notes,
    orderReference: invoice.order?.reference ?? null,
    company: invoice.company ?? {},
    companyLogoPng,
    customerName: `${user.firstName} ${user.lastName}`.trim(),
    customerEmail: user.email,
    footerNote: billing?.invoice.footerNote ?? null,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.reference}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
