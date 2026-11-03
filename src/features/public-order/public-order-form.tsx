"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { deliverySlotKey, deliverySlotLabel, type CompanyDeliverySlots } from "@/lib/validations/delivery-slots";

const EMPTY_STOP = { address: "", postalCode: "", city: "", instructions: "" };
const selectClass = "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm max-md:h-11 max-md:text-base";

const FIELD_ERRORS: Record<string, string> = {
  name: "Indiquez votre nom.",
  email: "Indiquez un e-mail valide : le lien de suivi y sera envoyé.",
  phone: "Indiquez un téléphone valide.",
  "pickup.address": "Indiquez l'adresse d'enlèvement.",
  "pickup.postalCode": "Vérifiez le code postal d'enlèvement.",
  "pickup.city": "Indiquez la ville d'enlèvement.",
  "delivery.address": "Indiquez l'adresse de livraison.",
  "delivery.postalCode": "Vérifiez le code postal de livraison.",
  "delivery.city": "Indiquez la ville de livraison.",
  requestedDeliveryDate: "Choisissez la date de livraison.",
  quantity: "Indiquez le nombre de colis.",
};

function StopFields({ title, value, onChange }: {
  title: string;
  value: typeof EMPTY_STOP;
  onChange: (key: keyof typeof EMPTY_STOP, value: string) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField label="Adresse" required>
            <Input value={value.address} maxLength={200} autoComplete="street-address" onChange={(event) => onChange("address", event.target.value)} />
          </FormField>
        </div>
        <FormField label="Code postal" required>
          <Input value={value.postalCode} maxLength={10} autoComplete="postal-code" onChange={(event) => onChange("postalCode", event.target.value)} />
        </FormField>
        <FormField label="Ville" required>
          <Input value={value.city} maxLength={120} autoComplete="address-level2" onChange={(event) => onChange("city", event.target.value)} />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Consignes">
            <Input value={value.instructions} maxLength={500} onChange={(event) => onChange("instructions", event.target.value)} placeholder="Code, étage, personne à demander" />
          </FormField>
        </div>
      </CardContent>
    </Card>
  );
}

export function PublicOrderForm({ token, slots }: { token: string; slots: CompanyDeliverySlots }) {
  const [idempotencyKey] = React.useState(() => `public-${crypto.randomUUID()}`);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [pickup, setPickup] = React.useState(EMPTY_STOP);
  const [delivery, setDelivery] = React.useState(EMPTY_STOP);
  const [packageName, setPackageName] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [date, setDate] = React.useState("");
  const [slot, setSlot] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{ reference: string; trackingUrl: string } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/public/orders/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey, name, email, phone, website,
          pickup, delivery, packageName, quantity,
          requestedDeliveryDate: date,
          ...(slot ? { requestedDeliverySlot: slot } : {}),
        }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        data?: { reference: string; trackingUrl: string }; error?: string; field?: string;
      };
      if (!response.ok || !json.data) {
        setError((json.field && FIELD_ERRORS[json.field]) || json.error || "Envoi impossible. Réessayez.");
        return;
      }
      setCreated(json.data);
    } catch {
      setError("Connexion impossible. Vérifiez le réseau puis réessayez.");
    } finally {
      setPending(false);
    }
  };

  if (created) {
    return (
      <Alert variant="success" className="mt-6">
        <AlertTitle>Commande envoyée{created.reference ? ` : ${created.reference}` : ""}</AlertTitle>
        <AlertDescription>
          Le transporteur va la prendre en charge. Le lien de suivi part aussi à {email}.
          {created.trackingUrl && <> <Link className="underline" href={created.trackingUrl}>Suivre ma livraison</Link></>}
        </AlertDescription>
      </Alert>
    );
  }

  const slotChoices = slots.mode === "SLOTS" ? slots.slots : [];
  return (
    <form className="mt-6 space-y-6" onSubmit={submit} aria-busy={pending}>
      <Card>
        <CardHeader><CardTitle className="text-base">Vos coordonnées</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Nom ou société" required>
              <Input value={name} maxLength={120} autoComplete="name" onChange={(event) => setName(event.target.value)} />
            </FormField>
          </div>
          <FormField label="E-mail" required>
            <Input type="email" value={email} maxLength={200} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
          </FormField>
          <FormField label="Téléphone" required>
            <Input type="tel" value={phone} maxLength={40} autoComplete="tel" onChange={(event) => setPhone(event.target.value)} />
          </FormField>
          {/* Pot de miel : hors écran et hors tabulation, seul un robot le remplit. */}
          <div className="absolute -left-[9999px]" aria-hidden>
            <label>Site web<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
          </div>
        </CardContent>
      </Card>
      <StopFields title="Enlèvement" value={pickup} onChange={(key, value) => setPickup((current) => ({ ...current, [key]: value }))} />
      <StopFields title="Livraison" value={delivery} onChange={(key, value) => setDelivery((current) => ({ ...current, [key]: value }))} />
      <Card>
        <CardHeader><CardTitle className="text-base">Colis et date</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nature du colis">
            <Input value={packageName} maxLength={200} onChange={(event) => setPackageName(event.target.value)} placeholder="Plis, carton, palette" />
          </FormField>
          <FormField label="Quantité" required>
            <Input type="number" min={1} max={999} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
          </FormField>
          <FormField label="Date de livraison" required>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </FormField>
          {slotChoices.length > 0 && (
            <FormField label="Créneau" required>
              <select className={selectClass} value={slot} onChange={(event) => setSlot(event.target.value)}>
                <option value="">Choisir</option>
                {slotChoices.map((choice) => (
                  <option key={deliverySlotKey(choice)} value={deliverySlotKey(choice)}>{deliverySlotLabel(choice)}</option>
                ))}
              </select>
            </FormField>
          )}
        </CardContent>
      </Card>
      <div aria-live="polite">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Commande non envoyée</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
        Envoyer la commande
      </Button>
    </form>
  );
}
