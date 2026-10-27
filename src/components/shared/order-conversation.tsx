"use client";
import { useRef, useState } from "react";
import { OperationalAlertsInbox, OrderOperationalAlerts } from "@/components/shared/operational-alerts";
import { dateTimeLabel } from "@/lib/format/relative-day";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Message = { id: string; body: string; kind: string; internal: boolean; authorName: string; authorRole: string; createdAt: string };
type Thread = { reference: string; messages: Message[]; watermark: string | null; unread: number; canWrite: boolean; canNote: boolean; closed: boolean; hasMore: boolean };
const kinds: Record<string, string> = { QUESTION: "Question", INSTRUCTION: "Instruction", CHANGE: "Modification", INCIDENT: "Incident" };
const roles: Record<string, string> = { CLIENT: "Client", DRIVER: "Chauffeur", COMPANY_ADMIN: "Administration", MINI_ADMIN: "Administration", SUPER_ADMIN: "Administration", DISPATCHER: "Dispatch" };
async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, { method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? "Échanges indisponibles.");
  return json.data;
}
export function OrderConversation({ orderId }: { orderId: string }) {
  const cache = useQueryClient();
  const [before, setBefore] = useState<string | null>(null);
  const [body, setBody] = useState(""); const [kind, setKind] = useState("QUESTION"); const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const attempt = useRef<{ key: string; signature: string } | null>(null); const sending = useRef(false);
  const url = `/api/order-conversations/${orderId}`;
  const query = useQuery({ queryKey: ["order-conversation", orderId, before], queryFn: () => request<Thread>(url + (before ? `?before=${encodeURIComponent(before)}` : "")), refetchInterval: 10_000, retry: false });
  const data = query.data;
  async function refresh() { await cache.invalidateQueries({ queryKey: ["order-conversation", orderId] }); await cache.invalidateQueries({ queryKey: ["order-message-notifications"] }); }
  async function send(event: React.FormEvent) {
    event.preventDefault(); if (sending.current) return;
    sending.current = true; setBusy(true); setError(null);
    const input = { body: body.trim(), kind, internal: Boolean(data?.canNote && internal) };
    const signature = JSON.stringify(input);
    if (!attempt.current || attempt.current.signature !== signature) attempt.current = { key: crypto.randomUUID(), signature };
    try { await request(url, "POST", { ...input, requestKey: attempt.current.key }); setBody(""); attempt.current = null; setBefore(null); await refresh(); }
    catch (e) { setError((e as Error).message); await query.refetch(); }
    finally { sending.current = false; setBusy(false); }
  }
  async function markRead() {
    if (!data?.watermark) return;
    try { await request(url, "PATCH", { messageId: data.watermark }); await refresh(); } catch (e) { setError((e as Error).message); }
  }
  if (query.error) return <p role="alert" className="rounded border p-4">{query.error.message}</p>;
  if (!data) return <p className="p-4">Chargement des échanges…</p>;
  return <Card id="messages">
    <CardHeader><CardTitle className="text-base">Échanges</CardTitle><p className="text-sm text-muted-foreground">Messages partagés avec le client, l’administration et le chauffeur affecté. Actualisation toutes les 10 secondes.</p></CardHeader>
    <CardContent className="space-y-4">
      <OrderOperationalAlerts orderId={orderId} />
      {data.unread > 0 && <div className="flex flex-wrap items-center gap-2" role="status"><strong>{data.unread} nouveau(x) message(s)</strong><Button variant="outline" size="sm" onClick={markRead}>Marquer ces messages comme lus</Button></div>}
      <div className="flex gap-2">{data.hasMore && <Button variant="outline" size="sm" onClick={() => setBefore(data.messages[0]?.id ?? null)}>Messages précédents</Button>}{before && <Button variant="outline" size="sm" onClick={() => setBefore(null)}>Derniers messages</Button>}</div>
      <div className="max-h-[45vh] space-y-3 overflow-y-auto" aria-label="Fil des échanges">
        {!data.messages.length && <p className="text-sm text-muted-foreground">Aucun échange pour cette commande.</p>}
        {data.messages.map(message => <article key={message.id} className={`rounded-lg border p-3 ${message.internal ? "border-amber-400 bg-amber-50 text-slate-900" : "bg-muted/30"}`}>
          <div className="flex flex-wrap gap-x-2 text-xs"><strong>{message.authorName}</strong><span>{roles[message.authorRole] ?? "Équipe"}</span><time dateTime={message.createdAt}>{dateTimeLabel(message.createdAt)}</time><strong>{message.internal ? "Note interne — administration uniquement" : kinds[message.kind]}</strong></div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.body}</p>
        </article>)}
      </div>
      {data.closed && <p className="text-sm text-muted-foreground">Mission terminée : historique en lecture seule. Pour une nouvelle demande, contactez le support.</p>}
      {data.canWrite && <form onSubmit={send} className="space-y-3">
        <label className="block text-sm">Type d’échange<select aria-label="Type d’échange" value={kind} onChange={e => setKind(e.target.value)} disabled={busy} className="ml-2 rounded border bg-background p-2">{Object.entries(kinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {data.canNote && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} disabled={busy} />Note interne (administration uniquement, cachée au client et au chauffeur)</label>}
        <label className="block text-sm">{internal && data.canNote ? "Note interne" : "Message partagé"}<textarea aria-label={internal && data.canNote ? "Note interne" : "Message partagé"} value={body} onChange={e => setBody(e.target.value)} maxLength={4000} required disabled={busy} rows={3} className="mt-1 block w-full rounded-md border bg-background p-3" /></label>
        <Button type="submit" disabled={busy || !body.trim()}>{busy ? "Envoi…" : internal && data.canNote ? "Ajouter la note interne" : "Envoyer le message partagé"}</Button>
      </form>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </CardContent>
  </Card>;
}
export function OrderConversationTrigger({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" size="sm">Échanges de la commande</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Échanges de la commande</DialogTitle></DialogHeader>{open && <OrderConversation key={orderId} orderId={orderId} />}</DialogContent></Dialog>;
}
export function OrderMessagesInbox({ enableDispatchTargets = false }: { enableDispatchTargets?: boolean } = {}) {
  const [selected, setSelected] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["order-message-notifications"], queryFn: () => request<Array<{ id: string; orderId: string; reference: string; title: string }>>("/api/order-conversations/notifications"), refetchInterval: 10_000, retry: false });
  const rows = query.error ? [] : query.data ?? [];
  return <><OperationalAlertsInbox onOpen={setSelected} enableDispatchTargets={enableDispatchTargets} />{rows.length > 0 && <div className="mb-4 rounded-lg border border-brand/30 bg-brand/5 p-3" aria-label="Nouveaux échanges"><p className="text-sm font-medium">Nouveaux échanges de commande</p><div className="flex flex-wrap gap-2">{Array.from(new Map(rows.map(row => [row.orderId, row])).values()).map(row => <Button key={row.orderId} variant="ghost" size="sm" onClick={() => setSelected(row.orderId)}>{row.reference} — ouvrir les échanges</Button>)}</div></div>}<Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Échanges de la commande</DialogTitle></DialogHeader>{selected && <OrderConversation key={selected} orderId={selected} />}</DialogContent></Dialog></>;
}
