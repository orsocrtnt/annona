import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/api/server-auth";
import { getCompanyClients } from "@/domains/client-portal/client-admin.service";
import { CompanyClientsContent } from "@/features/back-office/company-clients-content";
import type { CompanyClient } from "@/features/back-office/types";
import { serialize } from "@/lib/serialize";

export default async function CompanyClientsPage() {
  const auth = await getServerAuth("users:read");
  if (!auth) redirect("/login");

  const companyId = auth.user.companyId;
  if (!companyId) redirect("/login");

  const clients = await getCompanyClients(companyId);
  return <CompanyClientsContent initialClients={serialize(clients) as unknown as CompanyClient[]} />;
}
