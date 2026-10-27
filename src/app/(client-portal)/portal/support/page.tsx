"use client";

import Link from "next/link";
import { withoutRolePrefix } from "@/lib/format/person-labels";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import {
  usePortalSupportTickets,
  useCreateSupportTicket,
  usePortalSupportContacts,
  usePortalDeliveries,
} from "@/features/client-portal/hooks";
import { TicketStatusBadge } from "@/features/client-portal/status-badges";
import { createSupportTicketSchema, type CreateSupportTicketInput } from "@/lib/validations/support";
import { HeadphonesIcon, MessageSquare, Phone, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

export default function ClientSupportPage() {
  const { data: tickets, isLoading, error, refetch } = usePortalSupportTickets();
  const { data: contacts } = usePortalSupportContacts();
  const { data: deliveries } = usePortalDeliveries();
  const createTicket = useCreateSupportTicket();

  const form = useForm<CreateSupportTicketInput>({
    resolver: zodResolver(createSupportTicketSchema),
    defaultValues: {
      subject: "",
      message: "",
      contactType: contacts?.recommended ?? "ADMIN",
    },
  });

  const onSubmit = async (data: CreateSupportTicketInput) => {
    try {
      await createTicket.mutateAsync(data);
      form.reset({ subject: "", message: "", contactType: contacts?.recommended ?? "ADMIN" });
      toast.success("Demande envoyée");
    } catch {
      toast.error("Impossible d'envoyer votre demande");
    }
  };

  if (isInitialQueryLoading(isLoading, tickets)) return <PageSkeleton />;

  if (error) {
    return (
      <EmptyState
        icon={HeadphonesIcon}
        title="Support indisponible"
        description="Impossible de charger vos demandes pour le moment."
        action={{ label: "Réessayer", onClick: () => void refetch() }}
      />
    );
  }

  const activeContact =
    form.watch("contactType") === "DRIVER" && contacts?.driver
      ? contacts.driver
      : contacts?.admin;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
        <p className="mt-1 text-muted-foreground">
          Contactez votre administrateur ou votre chauffeur selon votre livraison
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className={contacts?.recommended === "ADMIN" ? "border-brand/30" : ""}>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-subtle">
              <User className="h-6 w-6 text-brand" />
            </div>
            <div>
              <p className="font-medium">Administrateur</p>
              <p className="text-sm text-muted-foreground">{contacts?.admin.name}</p>
              {contacts?.admin.email && (
                <a href={`mailto:${contacts.admin.email}`} className="text-sm text-brand hover:underline">
                  {contacts.admin.email}
                </a>
              )}
              {contacts?.admin.phone && (
                <p className="text-sm text-muted-foreground">{contacts.admin.phone}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {contacts?.driver ? (
          <Card className={contacts.recommended === "DRIVER" ? "border-brand/30" : ""}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-subtle">
                <Phone className="h-6 w-6 text-brand" />
              </div>
              <div>
                <p className="font-medium">Votre livreur</p>
                <p className="text-sm text-muted-foreground">
                  {withoutRolePrefix(contacts.driver.name)} · <span className="tabular-nums">{contacts.driver.deliveryReference}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Disponible si livraison en cours ou livrée depuis moins de 24h
                </p>
                {contacts.driver.phone ? (
                  <a href={`tel:${contacts.driver.phone}`} className="text-sm text-brand hover:underline">
                    {contacts.driver.phone}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Téléphone non renseigné</p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <Phone className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Chauffeur</p>
                <p className="text-sm text-muted-foreground">
                  Non disponible — aucune livraison en cours ou récente
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HeadphonesIcon className="h-5 w-5" />
            Nouvelle demande
          </CardTitle>
          <CardDescription>
            Choisissez qui contacter et décrivez votre problème
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Contacter" required>
              <Controller
                name="contactType"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Administrateur</SelectItem>
                      <SelectItem value="DRIVER" disabled={!contacts?.driver}>
                        {contacts?.driver?.name ?? "Livreur (indisponible)"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            {deliveries && deliveries.length > 0 && (
              <FormField label="Livraison concernée (optionnel)">
                <Controller
                  name="relatedDeliveryId"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveries.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.reference} — {d.status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            )}

            {activeContact && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">Contact sélectionné : {activeContact.name}</p>
                {"email" in activeContact && activeContact.email && (
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-3 w-3" /> {activeContact.email}
                  </p>
                )}
                {"phone" in activeContact && activeContact.phone && (
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-3 w-3" /> {activeContact.phone}
                  </p>
                )}
              </div>
            )}

            <FormField label="Sujet" error={form.formState.errors.subject?.message} required>
              <Input placeholder="Ex: Problème de livraison" {...form.register("subject")} />
            </FormField>
            <FormField label="Message" error={form.formState.errors.message?.message} required>
              <textarea
                className="flex min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Décrivez votre demande..."
                {...form.register("message")}
              />
            </FormField>
            <Button type="submit" variant="brand" loading={createTicket.isPending}>
              Envoyer
            </Button>
          </form>
        </CardContent>
      </Card>

      {tickets && tickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Mes demandes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tickets.map((ticket) => (
              <div id={`ticket-${ticket.id}`} key={ticket.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{ticket.subject}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{ticket.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(ticket.createdAt)}</p>
                    {ticket.relatedDelivery && (
                      <p className="text-xs text-muted-foreground">
                        Livraison {ticket.relatedDelivery.reference}
                      </p>
                    )}
                    <Link
                      href={`/portal/support/${ticket.id}`}
                      className="mt-2 inline-flex text-sm font-medium text-brand hover:underline"
                    >
                      Voir l’échange et répondre
                    </Link>
                  </div>
                  <TicketStatusBadge status={ticket.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
