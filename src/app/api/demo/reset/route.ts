import { NextResponse } from "next/server";
import { getDemoBaseAuthUser } from "@/domains/demo/demo-auth.service";
import { resetDemoScenario } from "@/domains/demo/demo-scenario.service";
import { setDemoPersonaCookie } from "@/lib/demo/persona-cookie";
import { clearAuthCache } from "@/lib/api/auth-cache";
import { DEMO_LOGIN_EMAIL } from "@/lib/demo/constants";
import { getDemoPersonaUser } from "@/domains/demo/demo-users.service";
import { extractPermissionSlugs } from "@/domains/user/user.service";

export async function POST() {
  const baseUser = await getDemoBaseAuthUser();
  if (!baseUser?.companyId) {
    return NextResponse.json({ error: "Réservé à l'environnement de démo" }, { status: 403 });
  }

  const result = await resetDemoScenario(baseUser.companyId);
  await setDemoPersonaCookie("admin");
  clearAuthCache(baseUser.authId);

  const adminUser = await getDemoPersonaUser(baseUser.companyId, "admin");

  return NextResponse.json({
    success: true,
    deliveries: result.deliveries,
    user: adminUser,
    permissions: adminUser ? extractPermissionSlugs(adminUser) : [],
    redirectTo: "/dashboard",
    demo: {
      isDemo: true as const,
      persona: "admin" as const,
      loginEmail: DEMO_LOGIN_EMAIL,
    },
  });
}
