"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cake, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CakeChoice, CakeOrderRow } from "@/domains/shop/cake-order.service";
import { formatCents } from "@/lib/format/money";
import { parseEurosToCents } from "@/lib/validations/catalog";
import { shopCall } from "@/features/shops/shop-client";

interface CakesData {
  choices: CakeChoice[];
  orders: CakeOrderRow[];
  leadHours: number;
}

/** « AAAA-MM-JJ » et « HH:MM » à l'heure de Paris → instant ISO avec décalage (heure d'hiver ou d'été). */
function parisInstant(date: string, time: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(guess);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const offset = (hour - guess.getUTCHours() + 24) % 24;
  return new Date(guess.getTime() - offset * 3_600_000).toISOString();
}

function when(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}

/**
 * Lot 2, demande 9 — commandes de gâteaux des particuliers sur la tablette. Le prix est celui de la boutique pour
 * la taille choisie : affiché, jamais modifiable (demande 4, vérification 4). Paiement complet, ou acompte d'au
 * moins 50 %. Au retrait : « Soldée ».
 */
export function SellerCakes() {
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["shop", "cakes"], queryFn: () => shopCall<CakesData>("/api/shop/cakes") });
  const [productId, setProductId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [inscription, setInscription] = useState("");
  const [servings, setServings] = useState("");
  const [payment, setPayment] = useState<"FULL" | "DEPOSIT">("DEPOSIT");
  const [deposit, setDeposit] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("10:00");
  const [error, setError] = useState<string | null>(null);

  const choice = data.data?.choices.find((row) => row.productId === productId) ?? null;
  const size = choice?.sizes.find((row) => row.sizeId === sizeId) ?? null;
  const minimum = size ? Math.ceil(size.priceCents / 2) : null;

  const create = useMutation({
    mutationFn: () =>
      shopCall<CakeOrderRow>("/api/shop/cakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          sizeId,
          inscription: inscription.trim() || null,
          servings: Number(servings || size?.servings || 0),
          payment,
          depositCents: payment === "DEPOSIT" ? parseEurosToCents(deposit) : null,
          customerName,
          customerPhone,
          pickupAt: parisInstant(pickupDate, pickupTime),
        }),
      }),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["shop", "cakes"] });
      toast.success("Commande enregistrée", { description: `${row.productName} pour ${row.customerName}, reste à payer ${formatCents(row.dueCents)}.` });
      setInscription("");
      setCustomerName("");
      setCustomerPhone("");
      setDeposit("");
      setError(null);
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const settle = useMutation({
    mutationFn: (id: string) => shopCall<CakeOrderRow>(`/api/shop/cakes/${encodeURIComponent(id)}/settle`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["shop", "cakes"] });
      toast.success("Commande soldée");
    },
    onError: (failure: Error) => toast.error(failure.message),
  });

  if (data.isLoading && !data.data) return <PageSkeleton />;
  const ready = Boolean(size && customerName.trim() && customerPhone.trim() && pickupDate && (payment === "FULL" || deposit));
  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight"><Cake className="h-7 w-7 text-brand" aria-hidden /> Commandes de gâteaux</h1>
      {data.error ? <p role="alert" className="text-base text-error">{data.error.message}</p> : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Nouvelle commande</CardTitle>
          <p className="text-base text-muted-foreground">Au moins {data.data?.leadHours ?? 48} h avant le retrait. Paiement complet, ou acompte d&apos;au moins 50 %.</p>
        </CardHeader>
        <CardContent>
          {data.data && data.data.choices.length === 0 ? (
            <p className="text-base text-muted-foreground">Aucun gâteau n&apos;a encore de prix boutique : la responsable les saisit dans Paramètres › « Produits et prix ».</p>
          ) : (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                create.mutate();
              }}
            >
              <FormField label="Gâteau" required>
                <Select value={productId || undefined} onValueChange={(value) => { setProductId(value); setSizeId(""); }}>
                  <SelectTrigger className="h-12 text-base" aria-label="Gâteau"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {(data.data?.choices ?? []).map((row) => <SelectItem key={row.productId} value={row.productId}>{row.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Taille" required>
                <Select value={sizeId || undefined} onValueChange={(value) => { setSizeId(value); setServings(String(choice?.sizes.find((row) => row.sizeId === value)?.servings ?? "")); }} disabled={!choice}>
                  <SelectTrigger className="h-12 text-base" aria-label="Taille"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {(choice?.sizes ?? []).map((row) => <SelectItem key={row.sizeId} value={row.sizeId}>{row.servings} personnes</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Prix (prix boutique)">
                <p className="flex h-12 items-center rounded-lg border bg-muted px-3 text-lg font-semibold tabular-nums" data-testid="cake-price" aria-readonly>
                  {size ? formatCents(size.priceCents) : "—"}
                </p>
              </FormField>
              <FormField label="Nombre de parts" required>
                <Input inputMode="numeric" className="h-12 text-base" value={servings} onChange={(event) => setServings(event.target.value.replace(/\D/g, ""))} />
              </FormField>
              <FormField label="Inscription sur le gâteau" hint="Par exemple : « Joyeux anniversaire Maman ».">
                <Input className="h-12 text-base" maxLength={120} value={inscription} onChange={(event) => setInscription(event.target.value)} />
              </FormField>
              <FormField label="Paiement" required>
                <div className="flex gap-2">
                  <Button type="button" variant={payment === "FULL" ? "brand" : "outline"} className="h-12" onClick={() => setPayment("FULL")}>Réglé en totalité</Button>
                  <Button type="button" variant={payment === "DEPOSIT" ? "brand" : "outline"} className="h-12" onClick={() => setPayment("DEPOSIT")}>Acompte</Button>
                </div>
              </FormField>
              {payment === "DEPOSIT" ? (
                <FormField label="Montant de l'acompte (€)" hint={minimum ? `Au moins ${formatCents(minimum)}.` : undefined} required>
                  <Input inputMode="decimal" className="h-12 text-base" value={deposit} onChange={(event) => setDeposit(event.target.value)} data-testid="cake-deposit" />
                </FormField>
              ) : null}
              <FormField label="Nom du client" required>
                <Input className="h-12 text-base" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
              </FormField>
              <FormField label="Téléphone du client" required>
                <Input type="tel" className="h-12 text-base" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
              </FormField>
              <FormField label="Retrait" required>
                <div className="flex gap-2">
                  <Input type="date" className="h-12 text-base" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} aria-label="Date de retrait" />
                  <Input type="time" className="h-12 w-32 text-base" value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} aria-label="Heure de retrait" />
                </div>
              </FormField>
              {error ? <p role="alert" className="text-base text-error sm:col-span-2">{error}</p> : null}
              <div className="sm:col-span-2">
                <Button type="submit" size="lg" variant="brand" loading={create.isPending} disabled={!ready}>Enregistrer la commande</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-xl">À retirer</CardTitle></CardHeader>
        <CardContent>
          {(data.data?.orders ?? []).length === 0 ? (
            <p className="text-base text-muted-foreground">Aucune commande à venir.</p>
          ) : (
            <ul className="divide-y">
              {data.data!.orders.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-3 py-3" data-testid={`cake-order-${row.customerName}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-medium">{row.productName} · {row.sizeServings} personnes</p>
                    <p className="text-sm text-muted-foreground">
                      {row.customerName} · {row.customerPhone} · retrait {when(row.pickupAt)}
                      {row.inscription ? ` · « ${row.inscription} »` : ""}
                    </p>
                  </div>
                  {row.status === "SETTLED" ? (
                    <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" aria-hidden /> Soldée</Badge>
                  ) : (
                    <>
                      <span className="text-sm">Reste à payer <strong className="tabular-nums">{formatCents(row.dueCents)}</strong></span>
                      <Button type="button" variant="outline" size="lg" loading={settle.isPending && settle.variables === row.id} onClick={() => settle.mutate(row.id)}>
                        Soldée
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
