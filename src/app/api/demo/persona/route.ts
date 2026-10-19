import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemoBaseAuthUser } from "@/domains/demo/demo-auth.service";
import { getDemoPersonaUser } from "@/domains/demo/demo-users.service";
import {
  DEMO_LOGIN_EMAIL,
  DEMO_PERSONA_PATHS,
  type DemoPersona,
} from "@/lib/demo/constants";
import { setDemoPersonaCookie } from "@/lib/demo/persona-cookie";
import { isAccountActive } from "@/lib/auth/account-access";
import { extractPermissionSlugs } from "@/domains/user/user.service";
import { getDemoSessionCompanyId } from "@/domains/demo/demo-session.service";

const bodySchema = z.object({
  persona: z.enum(["admin", "client", "driver"]),
});

export async function POST(request: Request) {
  const baseUser = await getDemoBaseAuthUser();
  if (!baseUser?.companyId) {
    return NextResponse.json({ error: "Réservé à l'environnement de démo" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Persona invalide" }, { status: 400 });
  }

  const persona = parsed.data.persona as DemoPersona;
  const sessionCompanyId = await getDemoSessionCompanyId();
  if (!sessionCompanyId) {
    return NextResponse.json(
      { error: "Session de démonstration absente. Reconnectez-vous." },
      { status: 409 }
    );
  }
  const personaUser = await getDemoPersonaUser(sessionCompanyId, persona);
  if (!personaUser) {
    return NextResponse.json({ error: "Persona introuvable" }, { status: 404 });
  }

  if (!isAccountActive(personaUser)) {
    return NextResponse.json({ error: "Compte indisponible" }, { status: 403 });
  }

  await setDemoPersonaCookie(persona);

  return NextResponse.json({
    success: true,
    persona,
    user: personaUser,
    permissions: extractPermissionSlugs(personaUser),
    redirectTo: DEMO_PERSONA_PATHS[persona],
    demo: {
      isDemo: true as const,
      persona,
      loginEmail: DEMO_LOGIN_EMAIL,
    },
  });
}
