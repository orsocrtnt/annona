import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/api/server-auth";
import { demoPersonaForRole, DEMO_LOGIN_EMAIL } from "@/lib/demo/constants";
import { getSessionSaasAccess } from "@/domains/saas/saas-session";

export async function GET() {
  try {
    const auth = await getServerAuth();

    if (!auth) {
      return NextResponse.json({ user: null, permissions: [], demo: null, saas: null });
    }

    const demo = auth.isDemoSession
      ? {
          isDemo: true as const,
          persona: demoPersonaForRole(auth.user.role.systemRole),
          loginEmail: DEMO_LOGIN_EMAIL,
        }
      : null;

    return NextResponse.json({
      user: auth.user,
      permissions: auth.permissions,
      demo,
      saas: await getSessionSaasAccess(auth.user.companyId),
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la session" },
      { status: 500 }
    );
  }
}
