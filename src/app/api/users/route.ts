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
      auth.context.user.role.systemRole === "SUPER_ADMIN"
    );

    return NextResponse.json(
      {
        data: result.user,
        temporaryPassword: result.temporaryPassword,
        success: true,
        message: "Utilisateur créé. Communiquez les identifiants affichés dans le tableau.",
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const statusMap: Record<string, number> = {
      EMAIL_EXISTS: 409,
      INVALID_ROLE: 400,
      COMPANY_REQUIRED: 400,
    };
    const labels: Record<string, string> = {
      EMAIL_EXISTS: "Cet email est déjà utilisé.",
      INVALID_ROLE: "Rôle non autorisé.",
      COMPANY_REQUIRED: "Aucune entreprise associée. Créez d'abord une entreprise ou reconnectez-vous.",
    };

    if (message.startsWith("SUPABASE_CREATE_FAILED:")) {
      return NextResponse.json(
        { error: `Erreur Supabase : ${message.replace("SUPABASE_CREATE_FAILED:", "")}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: labels[message] ?? "Erreur lors de la création" },
      { status: statusMap[message] ?? 500 }
    );
  }
}
