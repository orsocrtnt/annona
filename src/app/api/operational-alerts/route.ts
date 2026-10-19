import { NextResponse } from "next/server";
import { conversationAuth } from "@/lib/api/conversation-auth";
import { ConversationError } from "@/domains/order-conversation/order-conversation.service";
import { listOperationalAlerts } from "@/domains/operational-alerts/operational-alerts.service";
export async function GET() {
  const auth = await conversationAuth(); if ("error" in auth) return auth.error;
  try { return NextResponse.json({ data: await listOperationalAlerts(auth.actor), success: true }); }
  catch (e) { return NextResponse.json({ error: e instanceof ConversationError ? e.message : "Alertes indisponibles." }, { status: e instanceof ConversationError ? e.status : 500 }); }
}
