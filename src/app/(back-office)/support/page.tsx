"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HeadphonesIcon, Mail, MessageSquare, Phone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { TicketStatusBadge } from "@/features/client-portal/status-badges";
import {
  useAddStaffSupportMessage,
  useCompanySupportTickets,
  useUpdateStaffSupportStatus,
} from "@/features/back-office/hooks";
import type { CompanySupportTicket } from "@/features/back-office/types";
import { cn } from "@/lib/utils";
import { fullDateLabel, inlineDayLabel, relativeDayLabel } from "@/lib/format/relative-day";
import { toast } from "sonner";

type Filter = "ACTIVE" | "ALL" | CompanySupportTicket["status"];

const STATUS_LABELS: Record<CompanySupportTicket["status"], string> = {
  OPEN: "Ouvert",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolu",
  CLOSED: "Fermé",
};

function SupportTicketCard({ ticket }: { ticket: CompanySupportTicket }) {
  const reply = useAddStaffSupportMessage();
  const updateStatus = useUpdateStaffSupportStatus();
  const [body, setBody] = useState("");

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const value = body.trim();
    if (!value) return;
    try {
      await reply.mutateAsync({ ticketId: ticket.id, body: value });
      setBody("");
      toast.success("Réponse envoyée au client");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Réponse impossible");
    }
  }

  async function setStatus(status: CompanySupportTicket["status"]) {
    try {
      await updateStatus.mutateAsync({ ticketId: ticket.id, status });
      toast.success(`Demande marquée « ${STATUS_LABELS[status]} »`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Statut impossible à modifier");
    }
  }

  return (
    <Card id={`ticket-${ticket.id}`} data-support-ticket={ticket.id}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{ticket.subject}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {ticket.customer.firstName} {ticket.customer.lastName} · mise à jour{" "}
              <time dateTime={ticket.updatedAt} title={fullDateLabel(ticket.updatedAt)}>
                {inlineDayLabel(ticket.updatedAt)}
              </time>
            </p>
          </div>
          <div data-current-status={ticket.status}>
            <TicketStatusBadge status={ticket.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <a className="inline-flex items-center gap-1 hover:text-foreground" href={`mailto:${ticket.customer.email}`}>
            <Mail className="h-3.5 w-3.5" aria-hidden="true" /> {ticket.customer.email}
          </a>
          {ticket.customer.phone ? (
            <a className="inline-flex items-center gap-1 hover:text-foreground" href={`tel:${ticket.customer.phone}`}>
              <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {ticket.customer.phone}
            </a>
          ) : null}
          {ticket.relatedOrder ? (
            <Link className="font-medium text-brand hover:underline" href={`/dashboard/orders/${ticket.relatedOrder.id}`}>
              Commande {ticket.relatedOrder.reference}
            </Link>
          ) : null}
          {ticket.relatedDelivery ? <span>Livraison {ticket.relatedDelivery.reference}</span> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Région nommée et focusable : l'historique défile aussi au clavier. */}
        <div
          role="region"
          tabIndex={0}
          aria-label={`Historique de ${ticket.subject}`}
          className="max-h-80 overflow-y-auto rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ol className="space-y-3">
            {ticket.messages.map((message) => (
              <li
                key={message.id}
                className={cn(
                  "max-w-[85%] rounded-2xl border p-3",
                  message.isStaff
                    ? "ml-auto rounded-br-md border-[#bfe9d0] bg-[#eafaf1]"
                    : "mr-auto rounded-bl-md border-border bg-[#f5f8f6]"
                )}
              >
                <p className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <strong className="text-foreground">{message.isStaff ? "Équipe" : "Client"}</strong>
                  <time dateTime={message.createdAt} title={fullDateLabel(message.createdAt)}>
                    {relativeDayLabel(message.createdAt, undefined, { withTime: true })}
                  </time>
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`status-${ticket.id}`} className="text-sm font-medium">Statut</label>
          <select
            id={`status-${ticket.id}`}
            value={ticket.status}
            disabled={updateStatus.isPending || reply.isPending}
            onChange={(event) => void setStatus(event.target.value as CompanySupportTicket["status"])}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <form onSubmit={send} className="space-y-2">
          <label htmlFor={`reply-${ticket.id}`} className="text-sm font-medium">Répondre au client</label>
          <textarea
            id={`reply-${ticket.id}`}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            maxLength={4000}
            required
            disabled={reply.isPending || updateStatus.isPending}
            className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" size="sm" disabled={reply.isPending || updateStatus.isPending || !body.trim()}>
            <Send className="h-4 w-4" /> {reply.isPending ? "Envoi…" : "Envoyer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function CompanySupportPage() {
  const query = useCompanySupportTickets();
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const tickets = useMemo(() => query.data ?? [], [query.data]);
  const filtered = useMemo(
    () => tickets.filter((ticket) => {
      if (filter === "ALL") return true;
      if (filter === "ACTIVE") return ticket.status === "OPEN" || ticket.status === "IN_PROGRESS";
      return ticket.status === filter;
    }),
    [filter, tickets]
  );
  const activeCount = tickets.filter((ticket) => ticket.status === "OPEN" || ticket.status === "IN_PROGRESS").length;

  if (query.isLoading) return <PageSkeleton />;
  if (query.error) {
    return (
      <EmptyState
        icon={HeadphonesIcon}
        title="Support indisponible"
        description="Impossible de charger les demandes de cette entreprise."
        action={{ label: "Réessayer", onClick: () => void query.refetch() }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Support clients</h1>
          <p className="mt-1 text-muted-foreground">
            Canal suivi : cet espace TutelLiv · objectif de première réponse sous 1 jour ouvré
          </p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-2 text-sm">
          <strong>{activeCount}</strong> demande{activeCount === 1 ? "" : "s"} active{activeCount === 1 ? "" : "s"}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <label htmlFor="support-filter" className="text-sm font-medium">Afficher</label>
          <select
            id="support-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value as Filter)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="ACTIVE">Demandes actives</option>
            <option value="ALL">Toutes les demandes</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={HeadphonesIcon}
          title="Aucune demande dans cette vue"
          description="Les nouveaux tickets client apparaîtront ici automatiquement."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((ticket) => <SupportTicketCard key={ticket.id} ticket={ticket} />)}
        </div>
      )}
    </div>
  );
}
