import { NextResponse } from "next/server";
import { remindInvoice } from "@/domains/invoice/invoice-reminder.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { getTransactionalEmailConfiguration } from "@/lib/email/transactional-email";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { fr } from "@/lib/i18n/fr";

/** FACT-1 — relance d'une facture à régler (service de relance existant : trace, anti-doublon 24 h). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("invoices:update");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    try {
      const result = await remindInvoice({
        companyId: guard.actor.companyId,
        invoiceId: id,
        userId: guard.actor.user.id,
        emailConfigured: getTransactionalEmailConfiguration().enabled,
      });
      if (!result) throw new DomainRuleError(404, fr.invoices.errors.notFound, "INVOICE_NOT_FOUND");
      return NextResponse.json({ data: result, success: true });
    } catch (error) {
      if (error instanceof Error && error.message === "INVOICE_NOT_REMINDABLE") {
        throw new DomainRuleError(409, fr.invoices.errors.notRemindable, "INVOICE_NOT_REMINDABLE");
      }
      throw error;
    }
  });
}
