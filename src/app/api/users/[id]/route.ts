import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { deleteUserByAdmin, updateMiniAdminByAdmin } from "@/domains/user/user.service";
import { updateMiniAdminSchema } from "@/lib/validations/user";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffRole("users:update");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return denied;
  if (auth.context.user.role.systemRole === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Mutation de compte non autorisée depuis la plateforme." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const companyId = getCompanyId(auth.context);

  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateMiniAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides" },
      { status: 400 }
    );
  }

  try {
    await updateMiniAdminByAdmin(id, parsed.data, companyId, auth.context.user.role.systemRole);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const statusMap: Record<string, number> = {
      MINI_ADMIN_MANAGEMENT_FORBIDDEN: 403,
      USER_NOT_FOUND: 404,
      ROLE_NOT_EDITABLE: 403,
      SETTINGS_CONFLICT: 409,
    };
    const labels: Record<string, string> = {
      MINI_ADMIN_MANAGEMENT_FORBIDDEN: "La gestion des mini-admins est réservée aux administrateurs principaux.",
      USER_NOT_FOUND: "Utilisateur introuvable.",
      ROLE_NOT_EDITABLE: "Seuls les mini-admins peuvent être modifiés ici.",
      SETTINGS_CONFLICT: "Les réglages ont changé pendant l'enregistrement. Rechargez puis réessayez.",
    };
    return NextResponse.json(
      { error: labels[message] ?? "Erreur lors de la mise à jour" },
      { status: statusMap[message] ?? 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffRole("users:delete");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return denied;
  if (auth.context.user.role.systemRole === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Mutation de compte non autorisée depuis la plateforme." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const companyId = getCompanyId(auth.context);

  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  try {
    await deleteUserByAdmin(
      id,
      auth.context.user.id,
      companyId,
      auth.context.user.role.systemRole
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const statusMap: Record<string, number> = {
      MINI_ADMIN_MANAGEMENT_FORBIDDEN: 403,
      USER_NOT_FOUND: 404,
      CANNOT_DELETE_SELF: 400,
      ROLE_NOT_DELETABLE: 403,
      DRIVER_HAS_ACTIVE_DELIVERIES: 409,
    };
    const labels: Record<string, string> = {
      MINI_ADMIN_MANAGEMENT_FORBIDDEN: "La gestion des mini-admins est réservée aux administrateurs principaux.",
      USER_NOT_FOUND: "Utilisateur introuvable.",
      CANNOT_DELETE_SELF: "Vous ne pouvez pas supprimer votre propre compte.",
      ROLE_NOT_DELETABLE: "Ce rôle ne peut pas être supprimé depuis cette page.",
      DRIVER_HAS_ACTIVE_DELIVERIES:
        "Ce livreur a encore une mission active. Réaffectez ou terminez ses missions avant de le supprimer.",
    };

    return NextResponse.json(
      {
        error: labels[message] ?? "Erreur lors de la suppression",
        ...(message === "DRIVER_HAS_ACTIVE_DELIVERIES" ? { code: message } : {}),
      },
      { status: statusMap[message] ?? 500 }
    );
  }
}
