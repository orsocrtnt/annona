import { CONFIG_MESSAGES } from "@/lib/config-messages";
import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { createUserSchema } from "@/lib/validations/user";
import { createUserByAdmin, listUsersForCompany } from "@/domains/user/user.service";

export async function GET() {
  const auth = await requireStaffRole("users:read");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return denied;

  if (auth.context.user.role.systemRole === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "La gestion des comptes d'entreprise n'est pas ouverte depuis la plateforme." },
      { status: 403 }
    );
  }

  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non définie" }, { status: 400 });
  }

  const users = await listUsersForCompany(companyId);

  return NextResponse.json({ data: users, success: true });
}

export async function POST(request: Request) {
  const auth = await requireStaffRole("users:create");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return denied;
  if (auth.context.user.role.systemRole === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Mutation de compte non autorisée depuis la plateforme." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides" },
      { status: 400 }
    );
  }

  try {
    const result = await createUserByAdmin(
      parsed.data,
      auth.context.user.companyId,
      auth.context.user.role.systemRole
    );

    return NextResponse.json(
      {
        data: result.user,
        invitationSent: result.invitationSent,
        success: true,
        message: "Invitation envoyée. Le destinataire choisira son mot de passe.",
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const statusMap: Record<string, number> = {
      MINI_ADMIN_MANAGEMENT_FORBIDDEN: 403,
      AUTH_EMAIL_NOT_CONFIGURED: 503,
      AUTH_RATE_LIMITED: 429,
      INVITATION_FAILED: 502,
      INVITATION_PROFILE_FAILED: 503,
      EMAIL_EXISTS: 409,
      INVALID_ROLE: 400,
      COMPANY_REQUIRED: 400,
    };
    const labels: Record<string, string> = {
      MINI_ADMIN_MANAGEMENT_FORBIDDEN: "La gestion des mini-admins est réservée aux administrateurs principaux.",
      AUTH_EMAIL_NOT_CONFIGURED: CONFIG_MESSAGES.INVITATION_EMAIL_NOT_CONFIGURED,
      AUTH_RATE_LIMITED: "Trop de demandes. Réessayez plus tard.",
      INVITATION_FAILED: "L’invitation n’a pas pu être envoyée : le service d’e-mail a refusé l’envoi. Vérifiez l’adresse du destinataire puis réessayez ; si cela se répète, contactez l’administrateur de la plateforme.",
      INVITATION_PROFILE_FAILED: "L’e-mail a pu être envoyé mais le profil n’a pas été créé. Réessayez la création.",
      EMAIL_EXISTS: "Cet email est déjà utilisé.",
      INVALID_ROLE: "Rôle non autorisé.",
      COMPANY_REQUIRED: "Aucune entreprise associée. Créez d'abord une entreprise ou reconnectez-vous.",
    };


    return NextResponse.json(
      { error: labels[message] ?? "Erreur lors de la création" },
      { status: statusMap[message] ?? 500 }
    );
  }
}
