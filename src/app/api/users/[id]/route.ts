import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { deleteUserByAdmin } from "@/domains/user/user.service";
import { updateCompanyAccount } from "@/domains/user/account-admin.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { updateAccountSchema } from "@/lib/validations/company-admin";
import { miniAdminModules } from "@/lib/permissions/mini-admin";

/**
 * ADM-01 : modifier un compte de l'entreprise (nom, téléphone, rôle, client rattaché), le désactiver
 * (`active: false` : connexion et API refusées) ou le réactiver. Compte d'une autre entreprise : 404.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("users:update");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const input = updateAccountSchema.parse(await readJsonBody(request));
    const data = await updateCompanyAccount(
      { companyId: guard.actor.companyId, userId: guard.actor.user.id, fullAdmin: miniAdminModules(guard.actor.user) === null },
      id,
      input
    );
    return NextResponse.json({ data, success: true });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffRole("users:delete");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["ADMIN"]);
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
      auth.context.user.role.systemRole,
      miniAdminModules(auth.context.user) === null
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const statusMap: Record<string, number> = {
      USER_NOT_FOUND: 404,
      CANNOT_DELETE_SELF: 400,
      ROLE_NOT_DELETABLE: 403,
      DRIVER_HAS_ACTIVE_DELIVERIES: 409,
    };
    const labels: Record<string, string> = {
      USER_NOT_FOUND: "Utilisateur introuvable.",
      CANNOT_DELETE_SELF: "Vous ne pouvez pas supprimer votre propre compte.",
      ROLE_NOT_DELETABLE: "Ce rôle ne peut pas être supprimé depuis cette page.",
      DRIVER_HAS_ACTIVE_DELIVERIES:
        "Ce livreur a encore une tournée en cours. Réattribuez ou terminez ses tournées avant de le supprimer.",
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
