import { NextResponse } from "next/server";
import { z } from "zod";
import { conversationAuth } from "@/lib/api/conversation-auth";
import { ConversationError, getOrderConversation, postOrderMessage, markOrderConversationRead } from "@/domains/order-conversation/order-conversation.service";
import { kickOperationJob } from "@/domains/operations/operation-job.service";
const schema = z.object({ body: z.string().trim().min(1).max(4000), kind: z.enum(["QUESTION", "INSTRUCTION", "CHANGE", "INCIDENT"]), internal: z.boolean().default(false), requestKey: z.string().uuid() }).strict();
type Context = { params: Promise<{ id: string }> };
function failure(error: unknown) {
  if (error instanceof ConversationError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Conversation request failed");
  return NextResponse.json({ error: "Échanges momentanément indisponibles." }, { status: 500 });
}
export async function GET(request: Request, { params }: Context) {
  const auth = await conversationAuth(); if ("error" in auth) return auth.error;
  try { const { id } = await params; const data = await getOrderConversation(auth.actor, id, new URL(request.url).searchParams.get("before") ?? undefined); return NextResponse.json({ data, success: true }); } catch (e) { return failure(e); }
}
export async function POST(request: Request, { params }: Context) {
  const auth = await conversationAuth(); if ("error" in auth) return auth.error;
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Message de 1 à 4 000 caractères, catégorie et clé de tentative requis." }, { status: 400 });
  try { const { id } = await params; const result = await postOrderMessage(auth.actor, id, input.data); if (result.jobId) kickOperationJob(result.jobId); return NextResponse.json({ data: { id: result.messageId }, success: true }, { status: result.replay ? 200 : 201 }); } catch (e) { return failure(e); }
}
export async function PATCH(request: Request, { params }: Context) {
  const auth = await conversationAuth(); if ("error" in auth) return auth.error;
  const input = z.object({ messageId: z.string().min(1).max(100) }).strict().safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Dernier message vu requis." }, { status: 400 });
  try { const { id } = await params; await markOrderConversationRead(auth.actor, id, input.data.messageId); return NextResponse.json({ success: true }); } catch (e) { return failure(e); }
}
