import { redirect } from "next/navigation";
import { requireServerRole } from "@/lib/api/server-auth";
import { getClientInvoices } from "@/domains/invoice/invoice.service";
import { ClientInvoicesContent } from "@/features/client-portal/client-invoices-content";
import type { PortalInvoice } from "@/features/client-portal/types";
import { serialize } from "@/lib/serialize";

export default async function ClientInvoicesPage() {
  const auth = await requireServerRole("CLIENT");
  if (!auth) redirect("/login/client");

  const invoices = await getClientInvoices(auth.user.id);
  return <ClientInvoicesContent initialInvoices={serialize(invoices) as unknown as PortalInvoice[]} />;
}
