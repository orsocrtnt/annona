"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useCompanyClients } from "@/features/back-office/hooks";
import type { OrderIntakeDraft } from "@/domains/order-intake/order-intake.draft";
import {
  buildOrderInputFromForm,
  draftToFormValues,
  type IntakeFormStop,
  type IntakeFormValues,
} from "@/domains/order-intake/order-intake.form";
import type { IntakeStop, IntakeTextField } from "@/domains/order-intake/order-intake.schema";
import { createClientOrderSchema } from "@/lib/validations/order";
import { OrderIntakeApiError } from "./order-intake-api";
import { useCreateIntakeOrder } from "./order-intake-hooks";

const FIELD_LABELS: Record<string, string> = {
  "pickup.address": "adresse d'enlèvement",
  "pickup.city": "ville d'enlèvement",
  "pickup.postalCode": "code postal d'enlèvement",
  deliveries: "lieu de livraison",
  address: "adresse de livraison",
  city: "ville de livraison",
  postalCode: "code postal de livraison",
  deadline: "date ou échéance",
  "packages.quantity": "quantité de colis",
  customer: "client",
};

const selectClass =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

interface CreatedOrder {
  id: string;
  reference?: string;
}

interface OrderIntakeDraftFormProps {
  draft: OrderIntakeDraft;
  /** Une clé par livraison, tirée à l'analyse : chaque clic renvoie la même. */
  idempotencyKeys: string[];
  ordersHref: string | null;
}

/** Drapeaux du brouillon ramenés à la livraison affichée (« deliveries.1.city » → « delivery.city »). */
function flagsFor(paths: string[], deliveryIndex: number) {
  const flags = new Set<string>();
  for (const path of paths) {
    const match = path.match(/^deliveries\.(\d+)\.(\w+)$/);
    if (match) {
      if (Number(match[1]) === deliveryIndex) flags.add(`delivery.${match[2]}`);
    } else if (path === "deliveries") {
      for (const key of ["address", "city", "postalCode"]) flags.add(`delivery.${key}`);
    } else {
      flags.add(path);
    }
  }
  return flags;
}

function missingLabel(path: string) {
  const local = path.replace(/^deliveries\.\d+\./, "");
  return FIELD_LABELS[path] ?? FIELD_LABELS[local] ?? path;
}

function SourceHint({ field }: { field: IntakeTextField | undefined }) {
  if (!field?.source) return null;
  return <>Extrait : « {field.source} »</>;
}

interface StopFieldsetProps {
  legend: string;
  prefix: "pickup" | "delivery";
  values: IntakeFormStop;
  extracted: IntakeStop | undefined;
  uncertain: Set<string>;
  missing: Set<string>;
  onChange: (key: keyof IntakeFormStop, value: string) => void;
}

function StopFieldset({ legend, prefix, values, extracted, uncertain, missing, onChange }: StopFieldsetProps) {
  const field = (key: keyof IntakeFormStop, label: string, required = false, autoComplete?: string) => {
    const path = `${prefix}.${key}`;
    const isMissing = missing.has(path) && !values[key].trim();
    const isUncertain = uncertain.has(path);
    return (
      <FormField
        label={label}
        required={required}
        error={isMissing ? "À compléter : absent du message." : undefined}
        hint={isUncertain ? "À vérifier : information peu sûre." : undefined}
      >
        <Input
          value={values[key]}
          onChange={(event) => onChange(key, event.target.value)}
          autoComplete={autoComplete}
          className={isUncertain ? "border-warning" : undefined}
          title={extracted?.[key]?.source ? `Extrait : « ${extracted[key].source} »` : undefined}
        />
      </FormField>
    );
  };
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium">{legend}</legend>
      {field("address", "Adresse", true, "off")}
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        {field("city", "Ville", true, "off")}
        {field("postalCode", "Code postal", true, "off")}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("contactName", "Contact sur place")}
        {field("phone", "Téléphone du contact")}
      </div>
      {field("instructions", "Consignes")}
      {extracted?.address.source && (
        <p className="text-xs text-muted-foreground"><SourceHint field={extracted.address} /></p>
      )}
    </fieldset>
  );
}

export function OrderIntakeDraftForm({ draft, idempotencyKeys, ordersHref }: OrderIntakeDraftFormProps) {
  const deliveryCount = Math.max(1, draft.deliveries.length);
  const [active, setActive] = React.useState(0);
  const [forms, setForms] = React.useState<IntakeFormValues[]>(() =>
    Array.from({ length: deliveryCount }, (_, index) => draftToFormValues(draft, index))
  );
  const [customerId, setCustomerId] = React.useState(draft.customerMatch?.customerId ?? "");
  const [created, setCreated] = React.useState<Record<number, CreatedOrder>>({});
  const [errors, setErrors] = React.useState<string[]>([]);
  const clients = useCompanyClients();
  const createOrder = useCreateIntakeOrder();

  const values = forms[active]!;
  const missing = flagsFor(draft.missingFields, active);
  const uncertain = flagsFor(draft.uncertainFields, active);
  const createdHere = created[active];
  const activeClients = (clients.data ?? []).filter((client) => client.status === "ACTIVE");

  const update = (patch: Partial<IntakeFormValues>) =>
    setForms((current) => current.map((form, index) => (index === active ? { ...form, ...patch } : form)));
  const updateStop = (stop: "pickup" | "delivery") => (key: keyof IntakeFormStop, value: string) =>
    setForms((current) => current.map((form, index) => (index === active ? { ...form, [stop]: { ...form[stop], [key]: value } } : form)));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (createOrder.isPending || createdHere) return;
    const order = buildOrderInputFromForm(values);
    const parsed = createClientOrderSchema.safeParse(order);
    const problems = [
      ...(customerId ? [] : ["Choisissez le client de la commande."]),
      ...(parsed.success ? [] : [...new Set(parsed.error.issues.map((issue) => issue.message))]),
    ];
    setErrors(problems);
    if (problems.length > 0) return;
    createOrder.mutate(
      { customerId, order, idempotencyKey: idempotencyKeys[active]! },
      {
        onSuccess: (result) => setCreated((current) => ({ ...current, [active]: result })),
        onError: (error) => setErrors([error instanceof OrderIntakeApiError ? error.message : "Création impossible. Réessayez."]),
      }
    );
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="text-base">Brouillon à relire</CardTitle>
        <p className="text-sm text-muted-foreground">
          Rien n&apos;est créé tant que vous n&apos;avez pas cliqué sur « Créer la commande ». Les champs marqués
          « À vérifier » sont peu sûrs ; les champs « À compléter » manquent dans le message.
        </p>
        {draft.urgency.value === "urgent" && <Badge variant="warning" className="w-fit">Urgent</Badge>}
        {draft.missingFields.length > 0 && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            <AlertTitle>Informations absentes du message</AlertTitle>
            <AlertDescription>
              {[...new Set(draft.missingFields.map(missingLabel))].join(", ")}.
            </AlertDescription>
          </Alert>
        )}
        {draft.deliveries.length > 1 && (
          <div role="group" aria-label="Livraisons détectées" className="flex flex-wrap gap-2">
            {draft.deliveries.map((_, index) => (
              <Button
                key={index}
                type="button"
                variant={index === active ? "default" : "outline"}
                aria-pressed={index === active}
                onClick={() => { setActive(index); setErrors([]); }}
              >
                Livraison {index + 1}{created[index] ? " — créée" : ""}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5" aria-busy={createOrder.isPending} noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Client"
              required
              error={missing.has("customer") && !customerId ? "À compléter : expéditeur non rapproché." : undefined}
              hint={draft.customerMatch && customerId === draft.customerMatch.customerId
                ? `Rapproché par ${draft.customerMatch.matchedBy === "email" ? "e-mail" : "téléphone"} de l'expéditeur.`
                : draft.customerHint.name.value ? `Nom lu dans le message : ${draft.customerHint.name.value}` : undefined}
            >
              <select className={selectClass} value={customerId} onChange={(event) => setCustomerId(event.target.value)} disabled={clients.isLoading}>
                <option value="">{clients.isLoading ? "Chargement des clients…" : "Choisir un client"}</option>
                {activeClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {`${client.firstName} ${client.lastName}`.trim() || client.email} — {client.email}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Type de livraison" required>
              <select
                className={selectClass}
                value={values.deliveryCategory}
                onChange={(event) => update({ deliveryCategory: event.target.value as IntakeFormValues["deliveryCategory"] })}
              >
                <option value="COURIER">Course (enlèvement puis livraison)</option>
                <option value="STANDARD">Livraison standard</option>
              </select>
            </FormField>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <StopFieldset legend="Enlèvement" prefix="pickup" values={values.pickup} extracted={draft.pickup}
              uncertain={uncertain} missing={missing} onChange={updateStop("pickup")} />
            <StopFieldset legend={`Livraison${deliveryCount > 1 ? ` ${active + 1}` : ""}`} prefix="delivery" values={values.delivery}
              extracted={draft.deliveries[active]} uncertain={uncertain} missing={missing} onChange={updateStop("delivery")} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField
              label="Date de livraison"
              required
              error={missing.has("deadline") && !values.requestedDeliveryDate ? "À compléter : aucune date dans le message." : undefined}
              hint={uncertain.has("deadline") ? (draft.deadline.isPast ? "À vérifier : échéance déjà passée." : "À vérifier : date peu sûre.") : undefined}
            >
              <Input type="date" value={values.requestedDeliveryDate} onChange={(event) => update({ requestedDeliveryDate: event.target.value })} />
            </FormField>
            <FormField label="Échéance (heure de Paris)" hint={draft.deadline.source ? `Extrait : « ${draft.deadline.source} »` : undefined}>
              <Input value={values.deadlineLabel} onChange={(event) => update({ deadlineLabel: event.target.value })} placeholder="ex. avant 15:00" />
            </FormField>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={values.urgent} onChange={(event) => update({ urgent: event.target.checked })} className="h-4 w-4" />
                Urgent
              </label>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <FormField label="Nature des colis" hint={uncertain.has("packages.description") ? "À vérifier." : undefined}>
              <Input value={values.packageName} onChange={(event) => update({ packageName: event.target.value })} placeholder="ex. plis, cartons" />
            </FormField>
            <FormField
              label="Quantité"
              required
              error={missing.has("packages.quantity") && !values.quantity ? "À compléter." : undefined}
              hint={missing.has("packages.quantity") ? "Absente du message : vérifiez." : uncertain.has("packages.quantity") ? "À vérifier." : undefined}
            >
              <Input type="number" min={1} max={999} value={values.quantity}
                onChange={(event) => update({ quantity: Number(event.target.value) })} />
            </FormField>
          </div>
          <FormField label="Consignes générales">
            <Input value={values.instructions} onChange={(event) => update({ instructions: event.target.value })} />
          </FormField>

          <div aria-live="polite" className="space-y-3">
            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Commande non créée</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5">{errors.map((message) => <li key={message}>{message}</li>)}</ul>
                </AlertDescription>
              </Alert>
            )}
            {createdHere && (
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                <AlertTitle>Commande créée{createdHere.reference ? ` : ${createdHere.reference}` : ""}</AlertTitle>
                <AlertDescription>
                  Elle suit désormais le circuit habituel (dispatch, suivi, preuve).{" "}
                  {ordersHref && <Link className="underline" href={`${ordersHref}/${createdHere.id}`}>Ouvrir la commande</Link>}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={createOrder.isPending || Boolean(createdHere)}>
              {createOrder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {createdHere ? "Commande créée" : "Créer la commande"}
            </Button>
            <p className="text-xs text-muted-foreground">Le géocodage des adresses est fait par TutelLiv à la création.</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
