"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { buildDispatchTargetHref } from "@/features/back-office/dispatch-focus";
type ActionLog = { body: string; authorName: string; createdAt: string };
type Alert = { id: string; orderId: string; deliveryId: string | null; reference: string; title: string; detail: string; deadline: string | null; internal: boolean; state: string; acknowledged: ActionLog | null; resolution: ActionLog | null; canAct: boolean };
const labels: Record<string, string> = { OPEN: "À traiter", ACKNOWLEDGED: "Prise en compte", RESOLVED: "Résolue", CLOSED: "Clôturée — mission terminée" };
class AlertRequestError extends Error { constructor(message: string, public status: number) { super(message); } }
async function request<T>(url: string, input?: unknown): Promise<T> {
  const response = await fetch(url, input ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) } : {});
  const json = await response.json(); if (!response.ok) throw new AlertRequestError(json.error ?? "Alertes indisponibles.", response.status); return json.data;
}
export function OperationalAlertsInbox({ onOpen, enableDispatchTargets = false }: { onOpen: (id: string) => void; enableDispatchTargets?: boolean }) {
  const query = useQuery({ queryKey: ["operational-alerts"], queryFn: () => request<{ alerts: Alert[]; hasMore: boolean }>("/api/operational-alerts"), refetchInterval: 10_000, retry: false });
  if (query.error instanceof AlertRequestError && query.error.status === 403) return null;
  if (query.error) return <p role="alert" className="mb-3 text-sm text-destructive">Alertes opérationnelles indisponibles. Actualisez la page.</p>;
  const rows = query.data?.alerts ?? [];
  if (!rows.length && !query.data?.hasMore) return null;
  return <div className="mb-4 min-w-0 rounded-lg border border-amber-400 bg-amber-50 p-3 text-slate-900" aria-label="Alertes opérationnelles"><p className="font-medium">{rows.length} alerte(s) opérationnelle(s) à suivre</p><p className="text-xs">Lire une notification ne résout pas une alerte.</p><div className="mt-2 flex min-w-0 flex-wrap gap-2">{rows.map(row => enableDispatchTargets && row.deliveryId ? <Button key={row.id} variant="outline" size="sm" className="h-auto min-h-8 max-w-full whitespace-normal break-words py-2 text-left leading-snug" asChild><Link href={buildDispatchTargetHref(row.deliveryId, true)}>{row.reference} — {row.title} · {labels[row.state]} — ouvrir dans le dispatch</Link></Button> : <Button key={row.id} variant="outline" size="sm" className="h-auto min-h-8 max-w-full whitespace-normal break-words py-2 text-left leading-snug" onClick={() => onOpen(row.orderId)}>{row.reference} — {row.title} · {labels[row.state]}</Button>)}</div>{query.data?.hasMore && <p className="mt-2 text-sm">Liste limitée aux 100 dossiers récents. Consultez les alertes des autres dossiers depuis leur commande.</p>}</div>;
}
export function OrderOperationalAlerts({ orderId }: { orderId: string }) {
  const cache = useQueryClient(); const [notes, setNotes] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const url = `/api/operational-alerts/${orderId}`;
  const query = useQuery({ queryKey: ["operational-alerts", orderId], queryFn: () => request<Alert[]>(url), refetchInterval: 10_000, retry: false });
  async function act(row: Alert, action: "ack" | "resolve") {
    if (busy) return; setBusy(true); setError(null);
    try { await request(url, { alertId: row.id, action, note: notes[row.id]?.trim() ?? "" }); setNotes(current => ({ ...current, [row.id]: "" })); }
    catch (e) { setError((e as Error).message); }
    finally { await cache.invalidateQueries({ queryKey: ["operational-alerts"] }); await cache.invalidateQueries({ queryKey: ["order-conversation", orderId] }); await cache.invalidateQueries({ queryKey: ["order-message-notifications"] }); setBusy(false); }
  }
  if (query.error) return <p role="alert" className="text-sm text-destructive">{query.error.message}</p>;
  if (!query.data?.length) return null;
  return <section aria-label="Traitement des alertes" className="space-y-3 rounded-lg border p-3"><h3 className="font-semibold">Retards et incidents</h3><p className="text-xs text-muted-foreground">Retard calculé sur la date de livraison demandée. L’administration prend en compte puis indique l’action menée. Une mission terminée clôt automatiquement les alertes restantes.</p>{query.data.map(row => <article key={row.id} aria-label={row.title} className="space-y-2 rounded border p-3"><p className="text-sm font-medium">{row.title} — {labels[row.state]}{row.internal ? " · Interne — administration uniquement" : ""}</p><p className="whitespace-pre-wrap break-words text-sm">{row.detail}</p>{row.deadline && <p className="text-sm">Échéance demandée : <time dateTime={row.deadline}>{new Date(row.deadline).toLocaleString("fr-FR")}</time> (heure locale)</p>}{[row.acknowledged, row.resolution].filter(Boolean).map((log, i) => <p key={i} className="whitespace-pre-wrap break-words text-xs">{log!.body} · {log!.authorName} · <time dateTime={log!.createdAt}>{new Date(log!.createdAt).toLocaleString("fr-FR")}</time></p>)}{row.canAct && <div className="space-y-2"><label className="block text-sm">{row.state === "OPEN" ? "Action prévue" : "Action menée / résultat"}<textarea aria-label={`${row.state === "OPEN" ? "Action prévue" : "Action menée"} — ${row.title}`} rows={2} maxLength={1500} value={notes[row.id] ?? ""} onChange={e => setNotes(current => ({ ...current, [row.id]: e.target.value }))} disabled={busy} className="mt-1 block w-full rounded border bg-background p-2" /></label><Button size="sm" disabled={busy || !notes[row.id]?.trim()} onClick={() => act(row, row.state === "OPEN" ? "ack" : "resolve")}>{row.state === "OPEN" ? "Prendre en compte" : "Résoudre l’alerte"}</Button></div>}</article>)}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</section>;
}
