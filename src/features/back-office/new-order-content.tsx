"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { PageLoader } from "@/components/ui/loader";
import { backOfficeApi } from "@/features/back-office/api";
import { useCompanyClients, useCreateCustomerOrder, useOrderCreateOptions } from "@/features/back-office/hooks";
import { OrderFormFields } from "@/features/client-portal/create-order-form";
import { useCanOpenPage } from "@/hooks/use-can-open-page";
import { cn } from "@/lib/utils";
import {
  createClientOrderSchema,
  type CreateClientOrderFormInput,
  type CreateClientOrderInput,
} from "@/lib/validations/order";

const selectClass =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm max-md:h-11 max-md:text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

const CUSTOMER_REQUIRED = "Choisissez le client de la commande.";

interface NewOrderContentProps {
  backHref: string;
  backLabel: string;
  /** Liste donnant accès au détail d'une commande ; null dans l'espace dispatch. */
  ordersHref: string | null;
}

/** Commande saisie par l'équipe pour un client de l'entreprise (ADMIN-COMMANDE). */
export function NewOrderContent({ backHref, backLabel, ordersHref }: NewOrderContentProps) {
  const router = useRouter();
  const clients = useCompanyClients();
  const options = useOrderCreateOptions();
  const createOrder = useCreateCustomerOrder();
  const canOpenClients = useCanOpenPage("/dashboard/clients");
  // Une clé par formulaire : un double clic ou une réponse perdue rend la même commande.
  const idempotencyKey = React.useRef(crypto.randomUUID());
  const customerSelect = React.useRef<HTMLSelectElement>(null);
  const [customerId, setCustomerId] = React.useState("");
  const [customerError, setCustomerError] = React.useState<string>();

  const activeClients = (clients.data ?? []).filter((client) => client.status === "ACTIVE");

  const handleSubmit = async (data: CreateClientOrderInput | CreateClientOrderFormInput) => {
    if (!customerId) {
      setCustomerError(CUSTOMER_REQUIRED);
      customerSelect.current?.focus();
      toast.error(CUSTOMER_REQUIRED);
      return;
    }
    try {
      const order = await createOrder.mutateAsync({
        customerId,
        order: createClientOrderSchema.parse(data),
        idempotencyKey: idempotencyKey.current,
      });
      toast.success("Commande créée", { description: order.reference ? `Référence ${order.reference}` : undefined });
      router.push(ordersHref ? `${ordersHref}/${order.id}` : backHref);
    } catch (error) {
      toast.error("Création impossible", {
        description: error instanceof Error ? error.message : "Réessayez dans un instant.",
      });
    }
  };

  const loadFailed = clients.isError || options.isError;
  const loaded = !clients.isLoading && !options.isLoading;

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {backLabel}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nouvelle commande</h1>
        <p className="mt-1 text-muted-foreground max-md:hidden">
          Saisissez une commande pour le compte d&apos;un client de votre entreprise.
        </p>
      </div>

      {loadFailed ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            Impossible de charger le formulaire.
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                void clients.refetch();
                void options.refetch();
              }}
            >
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      ) : !loaded ? (
        <PageLoader />
      ) : activeClients.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aucun client actif</CardTitle>
            <CardDescription>
              Une commande se crée pour un client qui a un compte actif. Invitez d&apos;abord ce client.
            </CardDescription>
          </CardHeader>
          {canOpenClients && (
            <CardContent>
              <Link href="/dashboard/clients" className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>
                Voir les clients
              </Link>
            </CardContent>
          )}
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détails de la commande</CardTitle>
            <CardDescription>Le client la retrouvera dans son portail.</CardDescription>
          </CardHeader>
          {/* Avant la validation des champs : un formulaire vide signale aussi le client manquant. */}
          <CardContent
            className="space-y-6"
            onSubmitCapture={() => {
              if (!customerId) setCustomerError(CUSTOMER_REQUIRED);
            }}
          >
            <FormField label="Client" htmlFor="new-order-customer" error={customerError} required>
              <select
                ref={customerSelect}
                id="new-order-customer"
                className={selectClass}
                value={customerId}
                aria-invalid={Boolean(customerError)}
                onChange={(event) => {
                  setCustomerId(event.target.value);
                  setCustomerError(undefined);
                }}
              >
                <option value="">Choisir un client</option>
                {activeClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {`${client.firstName} ${client.lastName}`.trim() || client.email} — {client.email}
                  </option>
                ))}
              </select>
            </FormField>
            <OrderFormFields
              audience="staff"
              deliveryOptions={options.data}
              loadingOptions={false}
              estimateCourier={backOfficeApi.estimateCourier}
              onSubmit={handleSubmit}
              loading={createOrder.isPending}
              submitLabel="Créer la commande"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
