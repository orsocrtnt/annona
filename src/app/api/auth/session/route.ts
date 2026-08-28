import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/api/server-auth";
import { getDemoBaseAuthUser } from "@/domains/demo/demo-auth.service";
import { demoPersonaForRole, DEMO_LOGIN_EMAIL } from "@/lib/demo/constants";

export async function GET() {
  try {
    const auth = await getServerAuth();

    if (!auth) {
      return NextResponse.json({ user: null, permissions: [], demo: null });
    }

    const baseUser = await getDemoBaseAuthUser(auth.authId);
    const demo = baseUser
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
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la session" },
      { status: 500 }
    );
  }
}
