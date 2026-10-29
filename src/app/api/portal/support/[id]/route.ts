import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import {
  getClientTicketById,
  addClientTicketMessage,
} from "@/domains/support/support.service";
import { supportMessageSchema } from "@/lib/validations/support";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }
  const { id } = await params;
  const ticket = await getClientTicketById(auth.context.user.id, companyId, id);

  if (!ticket) {
    return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });
  }

  return NextResponse.json({ data: ticket, success: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = supportMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Message invalide" }, { status: 400 });
  }

  const message = await addClientTicketMessage(
    auth.context.user.id,
    companyId,
    id,
    parsed.data.body
  );

  if (!message) {
    return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });
  }

  return NextResponse.json({ data: message, success: true }, { status: 201 });
}
