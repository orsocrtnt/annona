import { NextResponse } from "next/server";
import { conversationAuth } from "@/lib/api/conversation-auth";
import { ConversationError } from "@/domains/order-conversation/order-conversation.service";
import { getOrderTracking } from "@/domains/tracking/tracking.service";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await conversationAuth(); if ("error" in auth) return auth.error;
  try { const { id } = await params; return NextResponse.json({ data: await getOrderTracking(auth.actor, id), success: true }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof ConversationError ? error.message : "Suivi momentanément indisponible." }, { status: error instanceof ConversationError ? error.status : 500 }); }
}
