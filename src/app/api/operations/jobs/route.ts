import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import {
  getOperationJobHealth,
  retryFailedOperationJobs,
} from "@/domains/operations/operation-job.service";

async function resolveCompany() {
  const auth = await requireStaffRole("deliveries:dispatch");
  if ("error" in auth) return auth;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
  if (denied) return { error: denied };

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return { error: NextResponse.json({ error: "Entreprise non associée" }, { status: 400 }) };
  }
  return { companyId };
}

export async function GET() {
  return withApiHandler(async () => {
    const resolved = await resolveCompany();
    if ("error" in resolved) return resolved.error;

    const health = await getOperationJobHealth(resolved.companyId);
    return NextResponse.json({ data: health, success: true });
  });
}

export async function POST() {
  return withApiHandler(async () => {
    const resolved = await resolveCompany();
    if ("error" in resolved) return resolved.error;

    const result = await retryFailedOperationJobs(resolved.companyId);
    return NextResponse.json({ data: result, success: true });
  });
}
