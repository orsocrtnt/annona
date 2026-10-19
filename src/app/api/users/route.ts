import { NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/api/auth-guard";
import { createUserSchema } from "@/lib/validations/user";
import { createUserByAdmin, listUsersForCompany, listAllUsers } from "@/domains/user/user.service";

export async function GET() {
  const auth = await requireStaffRole("users:read");
  if ("error" in auth) return auth.error;

  const isSuperAdmin = auth.context.user.role.systemRole === "SUPER_ADMIN";
  const companyId = auth.context.user.companyId;

  if (!isSuperAdmin && !companyId) {
    return NextResponse.json({ error: "Entreprise non définie" }, { status: 400 });
  }

  const users = isSuperAdmin
    ? await listAllUsers()
    : await listUsersForCompany(companyId!);

  return NextResponse.json({ data: users, success: true });
}

export async function POST(request: Request) {
  const auth = await requireStaffRole("users:create");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
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
      AUTH_EMAIL_NOT_CONFIGURED: "Les invitations par e-mail ne sont pas encore configurées.",
      AUTH_RATE_LIMITED: "Trop de demandes. Réessayez plus tard.",
      INVITATION_FAILED: "L’invitation n’a pas pu être envoyée. Réessayez plus tard.",
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
