import { NextResponse } from "next/server";
import { z } from "zod";
import { conversationAuth } from "@/lib/api/conversation-auth";
import { ConversationError } from "@/domains/order-conversation/order-conversation.service";
import { actOnOperationalAlert, getOrderOperationalAlerts } from "@/domains/operational-alerts/operational-alerts.service";
import { kickOperationJob } from "@/domains/operations/operation-job.service";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ alertId: z.string().min(1).max(250), action: z.enum(["ack", "resolve"]), note: z.string().trim().min(1).max(1500) }).strict();
function failure(e: unknown) { return NextResponse.json({ error: e instanceof ConversationError ? e.message : "Alertes momentanément indisponibles." }, { status: e instanceof ConversationError ? e.status : 500 }); }
export async function GET(_request: Request, { params }: Context) {
  const auth = await conversationAuth(); if ("error" in auth) return auth.error;
  try { return NextResponse.json({ data: await getOrderOperationalAlerts(auth.actor, (await params).id), success: true }); } catch (e) { return failure(e); }
}
export async function POST(request: Request, { params }: Context) {
  const auth = await conversationAuth(); if ("error" in auth) return auth.error;
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Action et motif de 1 à 1 500 caractères requis." }, { status: 400 });
  try { const result = await actOnOperationalAlert(auth.actor, (await params).id, input.data); if (result.jobId) kickOperationJob(result.jobId); return NextResponse.json({ data: { id: result.messageId, replay: result.replay }, success: true }, { status: result.replay ? 200 : 201 }); } catch (e) { return failure(e); }
}
