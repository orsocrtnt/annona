"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildDispatchTargetHref } from "@/features/back-office/dispatch-focus";
import { alertCountLabel, alertDeadlineLabel, alertKindLabel } from "@/lib/operational-alerts-display";
type ActionLog = { body: string; authorName: string; createdAt: string };
type Alert = { id: string; orderId: string; deliveryId: string | null; reference: string; title: string; detail: string; deadline: string | null; internal: boolean; state: string; acknowledged: ActionLog | null; resolution: ActionLog | null; canAct: boolean };
const labels: Record<string, string> = { OPEN: "À traiter", ACKNOWLEDGED: "Prise en compte", RESOLVED: "Résolue", CLOSED: "Clôturée — mission terminée" };
class AlertRequestError extends Error { constructor(message: string, public status: number) { super(message); } }
async function request<T>(url: string, input?: unknown): Promise<T> {
  const response = await fetch(url, input ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) } : {});
  const json = await response.json(); if (!response.ok) throw new AlertRequestError(json.error ?? "Alertes indisponibles.", response.status); return json.data;
}
const ALERTS_PREVIEW = 3;
type AlertRow = Pick<Alert, "id" | "orderId" | "deliveryId" | "reference" | "title" | "deadline" | "state"> & { customerName?: string | null; place?: string | null };
// Une alerte se lit comme une phrase : type, client, lieu, échéance. Les références restent pour les lecteurs d'écran et l'infobulle.
function AlertRowContent({ row, dispatch }: { row: AlertRow; dispatch: boolean }) {
  const late = row.id.startsWith("late:");
  const details = [row.place, alertDeadlineLabel(row.deadline)].filter(Boolean).join(" · ");
  const Icon = late ? Clock : AlertTriangle;
  return <><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#b3352a] ring-1 ring-[#f5dedb]" aria-hidden="true"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate font-medium text-foreground"><span className="text-[#b3352a]">{alertKindLabel(row)}</span>{row.customerName ? ` · ${row.customerName}` : ""}</span>{details && <span className="block text-xs text-[#545d57] max-sm:line-clamp-2 sm:truncate">{details}</span>}</span><span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-[#8a2a20] ring-1 ring-[#f5dedb] max-sm:hidden" aria-hidden="true">{labels[row.state]}</span><span className="sr-only">{`, ${labels[row.state]}, commande ${row.reference} — ${dispatch ? "ouvrir dans le dispatch" : "ouvrir la commande"}`}</span><ChevronRight className="h-4 w-4 shrink-0 text-[#b3352a]" aria-hidden="true" /></>;
}
export function OperationalAlertsInbox({ onOpen, enableDispatchTargets = false }: { onOpen: (id: string) => void; enableDispatchTargets?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const query = useQuery({ queryKey: ["operational-alerts"], queryFn: () => request<{ alerts: AlertRow[]; hasMore: boolean }>("/api/operational-alerts"), refetchInterval: 10_000, retry: false });
  if (query.error instanceof AlertRequestError && query.error.status === 403) return null;
  if (query.error) return <p role="alert" className="mb-3 text-sm text-destructive">Alertes opérationnelles indisponibles. Actualisez la page.</p>;
  const rows = query.data?.alerts ?? [];
  if (!rows.length && !query.data?.hasMore) return null;
  const visible = expanded ? rows : rows.slice(0, ALERTS_PREVIEW);
  // Direction Menthe (maquette pastel) : carte blanche, une ligne teintée par alerte.
  const rowClass = "flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl border border-[#f5dedb] bg-[linear-gradient(160deg,#fdecea_0%,#fffafa_70%)] px-3 py-2 text-left text-sm leading-snug transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2";
  return <section className="mb-6 min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="operational-alerts-title"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fde3e0] text-[#b3352a]" aria-hidden="true"><AlertTriangle className="h-[18px] w-[18px]" /></span><div><h2 id="operational-alerts-title" className="font-semibold">{alertCountLabel(rows.length)}</h2><p className="text-xs text-muted-foreground">Lire une notification ne résout pas une alerte.</p></div></div><ul className="mt-3 grid min-w-0 gap-2">{visible.map(row => <li key={row.id} className="min-w-0">{enableDispatchTargets && row.deliveryId ? <Link href={buildDispatchTargetHref(row.deliveryId, true)} className={rowClass} title={`Commande ${row.reference}`}><AlertRowContent row={row} dispatch /></Link> : <button type="button" className={rowClass} title={`Commande ${row.reference}`} onClick={() => onOpen(row.orderId)}><AlertRowContent row={row} dispatch={false} /></button>}</li>)}</ul>{rows.length > ALERTS_PREVIEW && <button type="button" className="mt-2 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Afficher moins" : `Afficher les ${rows.length - ALERTS_PREVIEW} autres`}</button>}{query.data?.hasMore && <p className="mt-3 text-sm text-muted-foreground">Liste limitée aux 100 dossiers récents. Consultez les alertes des autres dossiers depuis leur commande.</p>}</section>;
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
