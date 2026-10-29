"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { alertAccessLabel, alertBannerState, alertSeverity, alertSeverityLabel, alertToggleLabel, splitAlertsForMode, type AlertContext, type AlertMode } from "@/lib/operational-alerts-placement";
import { alertCountLabel, alertDeadlineLabel, alertKindLabel } from "@/lib/operational-alerts-display";
import { dateTimeLabel } from "@/lib/format/relative-day";
type ActionLog = { body: string; authorName: string; createdAt: string };
type Alert = { id: string; orderId: string; deliveryId: string | null; reference: string; title: string; detail: string; deadline: string | null; internal: boolean; state: string; acknowledged: ActionLog | null; resolution: ActionLog | null; canAct: boolean };
const labels: Record<string, string> = { OPEN: "À traiter", ACKNOWLEDGED: "Prise en compte", RESOLVED: "Résolue", CLOSED: "Clôturée — mission terminée" };
class AlertRequestError extends Error { constructor(message: string, public status: number) { super(message); } }
async function request<T>(url: string, input?: unknown): Promise<T> {
  const response = await fetch(url, input ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) } : {});
  const json = await response.json(); if (!response.ok) throw new AlertRequestError(json.error ?? "Alertes indisponibles.", response.status); return json.data;
}
type AlertRow = Pick<Alert, "id" | "orderId" | "deliveryId" | "reference" | "title" | "deadline" | "state"> & { customerName?: string | null; place?: string | null; missionActive?: boolean };
// Une alerte se lit comme une phrase : type, client, lieu, échéance. Les références restent pour les lecteurs d'écran et l'infobulle.
function AlertRowContent({ row, dispatch }: { row: AlertRow; dispatch: boolean }) {
  const late = row.id.startsWith("late:");
  const details = [row.place, alertDeadlineLabel(row.deadline)].filter(Boolean).join(" · ");
  const Icon = late ? Clock : AlertTriangle;
  const severity = alertSeverity(row);
  return <><Icon className="h-4 w-4 shrink-0 text-[#b3352a] dark:text-error" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block truncate font-medium text-foreground">{alertKindLabel(row)}{row.customerName ? ` · ${row.customerName}` : ""}</span>{details && <span className="block text-xs text-muted-foreground max-sm:line-clamp-2 sm:truncate">{details}</span>}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${severity === "urgent" ? "bg-[#fde3e0] text-[#8a2a20] dark:bg-[#4a2c2a] dark:text-error" : "bg-muted text-muted-foreground"}`} data-severity={severity}>{alertSeverityLabel(severity)}</span><span className="sr-only">{`, ${labels[row.state]}, commande ${row.reference} — ${dispatch ? "ouvrir la fiche livraison" : "ouvrir la commande"}`}</span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /></>;
}
const rowClass = "flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm leading-snug hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground";
function AlertList({ rows, onOpen, enableDispatchTargets, onNavigate }: { rows: AlertRow[]; onOpen: (id: string) => void; enableDispatchTargets: boolean; onNavigate?: () => void }) {
  return <ul className="grid min-w-0 gap-0.5">{rows.map(row => <li key={row.id} className="min-w-0">{enableDispatchTargets && row.deliveryId ? <Link href={`/dashboard/deliveries/${encodeURIComponent(row.deliveryId)}`} className={rowClass} title={`Commande ${row.reference}`} onClick={onNavigate}><AlertRowContent row={row} dispatch /></Link> : <button type="button" className={rowClass} title={`Commande ${row.reference}`} onClick={() => onOpen(row.orderId)}><AlertRowContent row={row} dispatch={false} /></button>}</li>)}</ul>;
}
// Bandeau : la première alerte (type, client, gravité) est toujours lisible et ouvrable ; seules les suivantes se replient.
function AlertSummary({ rows, hasMore, onOpen, enableDispatchTargets }: { rows: AlertRow[]; hasMore: boolean; onOpen: (id: string) => void; enableDispatchTargets: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const [lead, ...rest] = rows;
  if (!lead) return null;
  return <section className="mb-4 min-w-0 rounded-xl border border-border bg-card px-3 py-2" aria-label={alertCountLabel(rows.length)}>
    <div className="flex min-h-9 items-center gap-2"><p className="min-w-0 flex-1 truncate text-sm font-medium">{alertCountLabel(rows.length)}</p>{rest.length > 0 && <button type="button" className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground" aria-label={expanded ? "Masquer les autres alertes" : alertToggleLabel(rows.length)} aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>{expanded ? "Masquer" : `+${rest.length} autre${rest.length > 1 ? "s" : ""}`}</button>}</div>
    <AlertList rows={[lead]} onOpen={onOpen} enableDispatchTargets={enableDispatchTargets} />
    <div id={listId} hidden={!expanded}>{expanded && <><AlertList rows={rest} onOpen={onOpen} enableDispatchTargets={enableDispatchTargets} />{hasMore && <p className="px-2 pt-1 text-xs text-muted-foreground">Liste limitée aux 100 dossiers récents.</p>}</>}</div>
  </section>;
}
// Accès identifiable aux alertes qui ne sont pas au centre de la page : bouton compact avec compteur.
function AlertAccess({ rows, hasMore, onOpen, enableDispatchTargets, driver }: { driver?: boolean; rows: AlertRow[]; hasMore: boolean; onOpen: (id: string) => void; enableDispatchTargets: boolean }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button type="button" aria-label={alertAccessLabel(rows.length)} className={`fixed right-3 z-30 ${driver ? "bottom-[calc(7rem+env(safe-area-inset-bottom))]" : "bottom-24 lg:bottom-5 lg:right-5"} inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-medium shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground`}><AlertTriangle className="h-4 w-4 text-[#b3352a] dark:text-error" aria-hidden="true" />Alertes<span className="rounded-full bg-[#fde3e0] px-1.5 text-xs text-[#8a2a20] dark:bg-[#4a2c2a] dark:text-error" aria-hidden="true">{rows.length}</span></button></DialogTrigger>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{alertCountLabel(rows.length)}</DialogTitle><DialogDescription className="sr-only">Choisissez une alerte pour ouvrir la commande concernée.</DialogDescription></DialogHeader><AlertList rows={rows} onOpen={id => { setOpen(false); onOpen(id); }} enableDispatchTargets={enableDispatchTargets} onNavigate={() => setOpen(false)} />{hasMore && <p className="text-xs text-muted-foreground">Liste limitée aux 100 dossiers récents.</p>}</DialogContent>
  </Dialog>;
}
function useAlertsQuery() {
  return useQuery({ queryKey: ["operational-alerts"], queryFn: () => request<{ alerts: AlertRow[]; hasMore: boolean }>("/api/operational-alerts"), refetchInterval: 10_000, retry: false });
}
/** Vrai quand le bouton « Alertes » est affiché : la mise en page réserve alors de la place en bas (app livreur). */
export function useAlertAccessPresent(mode: AlertMode, context?: AlertContext): boolean {
  const query = useAlertsQuery();
  return splitAlertsForMode(query.data?.alerts ?? [], mode, context).behindAccess.length > 0;
}
export function OperationalAlertsInbox({ onOpen, enableDispatchTargets = false, mode = "summary", context, driver = false }: { onOpen: (id: string) => void; enableDispatchTargets?: boolean; mode?: AlertMode; context?: AlertContext; driver?: boolean }) {
  const query = useAlertsQuery();
  if (query.error instanceof AlertRequestError && query.error.status === 403) return null;
  if (alertBannerState({ error: Boolean(query.error), rows: [] }) === "error") return <p role="alert" className="mb-3 text-sm text-destructive">Alertes opérationnelles indisponibles. Actualisez la page.</p>;
  const rows = query.data?.alerts ?? [];
  const hasMore = Boolean(query.data?.hasMore);
  if (!rows.length && !hasMore) return null;
  if (!rows.length) return <p className="mb-3 text-sm text-muted-foreground">Liste limitée aux 100 dossiers récents. Consultez les alertes des autres dossiers depuis leur commande.</p>;
  const { top, behindAccess } = splitAlertsForMode(rows, mode, context);
  const props = { hasMore, onOpen, enableDispatchTargets };
  return <>{top.length > 0 && <AlertSummary rows={top} {...props} />}{behindAccess.length > 0 && <AlertAccess rows={behindAccess} driver={driver} {...props} />}</>;
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
  return <section aria-label="Traitement des alertes" className="space-y-3 rounded-lg border p-3"><h3 className="font-semibold">Retards et incidents</h3><details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Comment une alerte est traitée</summary><p className="mt-1">Retard calculé sur la date de livraison demandée. L’administration prend en compte puis indique l’action menée. Une mission terminée clôt automatiquement les alertes restantes.</p></details>{query.data.map(row => <article key={row.id} aria-label={row.title} className="space-y-2 rounded border p-3"><p className="text-sm font-medium">{alertKindLabel(row)} · {labels[row.state]}{row.internal ? " · interne, visible par l’administration uniquement" : ""}</p><p className="whitespace-pre-wrap break-words text-sm">{row.detail}</p>{row.deadline && <p className="text-sm">Livraison demandée pour le <time dateTime={row.deadline}>{dateTimeLabel(row.deadline)}</time></p>}{[row.acknowledged, row.resolution].filter(Boolean).map((log, i) => <p key={i} className="whitespace-pre-wrap break-words text-xs">{log!.body} · {log!.authorName} · <time dateTime={log!.createdAt}>{dateTimeLabel(log!.createdAt)}</time></p>)}{row.canAct && <div className="space-y-2"><label className="block text-sm">{row.state === "OPEN" ? "Action prévue" : "Action menée / résultat"}<textarea aria-label={`${row.state === "OPEN" ? "Action prévue" : "Action menée"} — ${row.title}`} rows={2} maxLength={1500} value={notes[row.id] ?? ""} onChange={e => setNotes(current => ({ ...current, [row.id]: e.target.value }))} disabled={busy} className="mt-1 block w-full rounded border bg-background p-2" /></label><Button size="sm" disabled={busy || !notes[row.id]?.trim()} onClick={() => act(row, row.state === "OPEN" ? "ack" : "resolve")}>{row.state === "OPEN" ? "Prendre en compte" : "Résoudre l’alerte"}</Button></div>}</article>)}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</section>;
}
