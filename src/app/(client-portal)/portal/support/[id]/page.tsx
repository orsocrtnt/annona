"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, HeadphonesIcon, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import {
  useAddPortalSupportMessage,
  usePortalSupportTicket,
} from "@/features/client-portal/hooks";
import { TicketStatusBadge } from "@/features/client-portal/status-badges";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function ClientSupportTicketPage() {
  const id = String(useParams<{ id: string }>().id);
  const ticket = usePortalSupportTicket(id);
  const reply = useAddPortalSupportMessage();
  const [body, setBody] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = body.trim();
    if (!value) return;
    try {
      await reply.mutateAsync({ ticketId: id, body: value });
      setBody("");
      toast.success("Réponse envoyée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’envoyer la réponse");
    }
  }

  if (ticket.isLoading) return <PageSkeleton />;
  if (ticket.error || !ticket.data) {
    return (
      <EmptyState
        icon={HeadphonesIcon}
        title="Demande introuvable"
        description="Cette demande n’existe pas ou ne vous appartient pas."
        action={{ label: "Retour au support", onClick: () => { window.location.href = "/portal/support"; } }}
      />
    );
  }

  const data = ticket.data;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/portal/support"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour au support
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.subject}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ouverte le {formatDate(data.createdAt)} · réponse visée sous 1 jour ouvré
          </p>
        </div>
        <div data-current-status={data.status}>
          <TicketStatusBadge status={data.status} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique de la demande</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3" aria-live="polite">
          {(data.messages ?? []).map((message) => (
            <article
              key={message.id}
              className={`rounded-lg border p-4 ${
                message.isStaff ? "border-brand/30 bg-brand/5" : "bg-muted/30"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <strong className="text-foreground">
                  {message.isStaff ? "Équipe de livraison" : "Vous"}
                </strong>
                <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.body}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajouter une réponse</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <label htmlFor="support-reply" className="text-sm font-medium">
              Votre message
            </label>
            <textarea
              id="support-reply"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={4000}
              rows={4}
              required
              disabled={reply.isPending}
              className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" variant="brand" disabled={reply.isPending || !body.trim()}>
              <Send className="h-4 w-4" />
              {reply.isPending ? "Envoi…" : "Envoyer la réponse"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
