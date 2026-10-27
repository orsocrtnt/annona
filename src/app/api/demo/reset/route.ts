import { NextResponse } from "next/server";
import { getDemoBaseAuthUser } from "@/domains/demo/demo-auth.service";
import { resetDemoScenario } from "@/domains/demo/demo-scenario.service";
import { setDemoPersonaCookie } from "@/lib/demo/persona-cookie";
import { isAccountActive } from "@/lib/auth/account-access";
import { DEMO_LOGIN_EMAIL } from "@/lib/demo/constants";
import { ensureDemoSessionRosterUsers, getDemoPersonaUser } from "@/domains/demo/demo-users.service";
import { extractPermissionSlugs } from "@/domains/user/user.service";
import { getDemoSessionCompanyId } from "@/domains/demo/demo-session.service";
import { getSessionSaasAccess } from "@/domains/saas/saas-session";

export async function POST() {
  const baseUser = await getDemoBaseAuthUser();
  if (!baseUser?.companyId) {
    return NextResponse.json({ error: "Réservé à l'environnement de démo" }, { status: 403 });
  }

  const sessionCompanyId = await getDemoSessionCompanyId();
  if (!sessionCompanyId) {
    return NextResponse.json(
      { error: "Session de démonstration absente. Reconnectez-vous." },
      { status: 409 }
    );
  }

  const adminUser = await getDemoPersonaUser(sessionCompanyId, "admin");
  if (!adminUser || !isAccountActive(adminUser)) {
    return NextResponse.json({ error: "Compte indisponible" }, { status: 403 });
  }

  // Roster à jour (livreurs ajoutés au scénario) avant de recréer les livraisons : upserts idempotents.
  await ensureDemoSessionRosterUsers(sessionCompanyId);
  const result = await resetDemoScenario(sessionCompanyId, new Date(), {
    ensureCanonicalRoster: false,
  });
  await setDemoPersonaCookie("admin");

  return NextResponse.json({
    success: true,
    deliveries: result.deliveries,
    user: adminUser,
    permissions: adminUser ? extractPermissionSlugs(adminUser) : [],
    saas: await getSessionSaasAccess(sessionCompanyId),
    redirectTo: "/dashboard",
    demo: {
      isDemo: true as const,
      persona: "admin" as const,
      loginEmail: DEMO_LOGIN_EMAIL,
    },
  });
}
