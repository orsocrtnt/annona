import { NextResponse } from "next/server";
import {
  addStaffTicketMessage,
  getStaffTicketById,
  updateStaffTicketStatus,
} from "@/domains/support/support.service";
import { requireSupportStaff } from "@/lib/api/support-staff-auth";
import { withApiHandler } from "@/lib/api/route-handler";
import {
  supportMessageSchema,
  updateSupportTicketStatusSchema,
} from "@/lib/validations/support";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  return withApiHandler(async () => {
    const auth = await requireSupportStaff();
    if ("error" in auth) return auth.error;
    const ticket = await getStaffTicketById(auth.companyId, (await params).id);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });
    }
    return NextResponse.json({ data: ticket, success: true });
  });
}

export async function POST(request: Request, { params }: Context) {
  return withApiHandler(async () => {
    const auth = await requireSupportStaff();
    if ("error" in auth) return auth.error;
    const parsed = supportMessageSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Message de 1 à 4 000 caractères requis" }, { status: 400 });
    }
    const result = await addStaffTicketMessage(
      auth.context.user.id,
      auth.companyId,
      (await params).id,
      parsed.data.body
    );
    if (!result) {
      return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });
    }
    return NextResponse.json({ data: result.ticket, success: true }, { status: 201 });
  });
}

export async function PATCH(request: Request, { params }: Context) {
  return withApiHandler(async () => {
    const auth = await requireSupportStaff();
    if ("error" in auth) return auth.error;
    const parsed = updateSupportTicketStatusSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }
    const ticket = await updateStaffTicketStatus(
      auth.companyId,
      (await params).id,
      parsed.data.status
    );
    if (!ticket) {
      return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });
    }
    return NextResponse.json({ data: ticket, success: true });
  });
}
