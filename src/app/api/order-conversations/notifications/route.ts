import { NextResponse } from "next/server";
import { conversationAuth } from "@/lib/api/conversation-auth";
import { ConversationError, listOrderMessageNotifications } from "@/domains/order-conversation/order-conversation.service";
export async function GET() {
  const auth = await conversationAuth(); if ("error" in auth) return auth.error;
  try { return NextResponse.json({ data: await listOrderMessageNotifications(auth.actor), success: true }); }
  catch (e) { return NextResponse.json({ error: e instanceof ConversationError ? e.message : "Notifications indisponibles." }, { status: e instanceof ConversationError ? e.status : 500 }); }
}
