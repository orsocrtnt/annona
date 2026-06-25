import { NextResponse } from "next/server";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import { deleteUserByAdmin } from "@/domains/user/user.service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffRole("users:delete");
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const isSuperAdmin = auth.context.user.role.systemRole === "SUPER_ADMIN";
  const companyId = getCompanyId(auth.context);

  if (!isSuperAdmin && !companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  try {
    await deleteUserByAdmin(
      id,
      auth.context.user.id,
      companyId,
      isSuperAdmin
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const statusMap: Record<string, number> = {
      USER_NOT_FOUND: 404,
      CANNOT_DELETE_SELF: 400,
      ROLE_NOT_DELETABLE: 403,
    };
    const labels: Record<string, string> = {
      USER_NOT_FOUND: "Utilisateur introuvable.",
      CANNOT_DELETE_SELF: "Vous ne pouvez pas supprimer votre propre compte.",
      ROLE_NOT_DELETABLE: "Ce rôle ne peut pas être supprimé depuis cette page.",
    };

    return NextResponse.json(
      { error: labels[message] ?? "Erreur lors de la suppression" },
      { status: statusMap[message] ?? 500 }
    );
  }
}
