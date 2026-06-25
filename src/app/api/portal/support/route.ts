import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { getClientTickets, createClientTicket } from "@/domains/support/support.service";
import { createSupportTicketSchema } from "@/lib/validations/support";

export async function GET() {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const tickets = await getClientTickets(auth.context.user.id);
  return NextResponse.json({ data: tickets, success: true });
}

export async function POST(request: Request) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createSupportTicketSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const ticket = await createClientTicket(
    auth.context.user.id,
    companyId,
    parsed.data
  );

  return NextResponse.json({ data: ticket, success: true }, { status: 201 });
}
