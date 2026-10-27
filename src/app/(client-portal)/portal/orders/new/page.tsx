"use client";

import Link from "next/link";
import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateOrderForm } from "@/features/client-portal/create-order-form";
import { useCreateOrder, useDeliveryReorderTemplate, useOrderReorderTemplate } from "@/features/client-portal/hooks";
import { PageLoader } from "@/components/ui/loader";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  createClientOrderSchema,
  type CreateClientOrderFormInput,
} from "@/lib/validations/order";

export default function NewOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromDelivery = searchParams.get("fromDelivery");
  const fromOrder = searchParams.get("fromOrder");
  const createOrder = useCreateOrder();
  const idempotencyKey = useRef(crypto.randomUUID());
  const { data: deliveryReorder, isLoading: loadingDeliveryTemplate, error: deliveryTemplateError } =
    useDeliveryReorderTemplate(fromDelivery);
  const { data: orderReorder, isLoading: loadingOrderTemplate, error: orderTemplateError } =
    useOrderReorderTemplate(fromOrder);

  const reorderTemplate = orderReorder
    ? {
        deliveryId: orderReorder.deliveryId ?? `order-${orderReorder.orderId}`,
        deliveryReference: orderReorder.deliveryReference,
        formValues: orderReorder.formValues,
      }
    : deliveryReorder;
  const loadingTemplate = loadingDeliveryTemplate || loadingOrderTemplate;
  const templateError = orderTemplateError ?? deliveryTemplateError;

  const handleSubmit = async (data: CreateClientOrderFormInput) => {
    try {
      const parsed = createClientOrderSchema.parse(data);
      const order = await createOrder.mutateAsync({
        data: parsed,
        idempotencyKey: idempotencyKey.current,
      });
      const isQuote = parsed.deliveryCategory === "SPECIAL_MISSION";
      toast.success(isQuote ? "Demande de devis envoyée" : "Commande créée", {
        description: isQuote
          ? `Référence ${order.reference} — nous vous recontactons sous peu`
          : `Référence ${order.reference}`,
      });
      router.push(`/portal/orders/${order.id}`);
    } catch (error) {
      toast.error("Erreur", {
        description: error instanceof Error ? error.message : "Création impossible",
      });
    }
  };

  if ((fromDelivery || fromOrder) && loadingTemplate) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/portal/orders"
        className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour aux commandes
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nouvelle commande</h1>
        <p className="mt-1 text-muted-foreground">
          {reorderTemplate
            ? `Reprise de la livraison ${reorderTemplate.deliveryReference} — modifiez si besoin`
            : "Créez une commande de livraison"}
        </p>
      </div>

      {templateError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger cette livraison passée. Vous pouvez créer une commande vierge.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails de la commande</CardTitle>
          <CardDescription>
            {reorderTemplate
              ? "Les adresses et articles de votre ancienne livraison sont pré-remplis"
              : "Ajoutez vos articles et l'adresse de livraison"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrderForm
            key={reorderTemplate?.deliveryId ?? "new-order"}
            initialValues={reorderTemplate?.formValues}
            onSubmit={handleSubmit}
            loading={createOrder.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
