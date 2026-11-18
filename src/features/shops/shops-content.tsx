"use client";

import { useState } from "react";
import { MapPin, Pencil, Plus, Store } from "lucide-react";
import { toast } from "sonner";
import { AddressFieldsGroup } from "@/components/addresses/address-fields-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useZones } from "@/features/settings/hooks";
import { useCreateShop, useShops, useUpdateShop, type ShopRow } from "@/features/shops/api";
import { CreateUserDialog } from "@/features/users/create-user-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import type { CreateShopInput } from "@/lib/validations/shop";

interface Values {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  accessInstructions: string;
  contactPhone: string;
  zoneId: string;
}

function initialValues(shop?: ShopRow): Values {
  return {
    name: shop?.name ?? "",
    address: shop?.address ?? "",
    postalCode: shop?.postalCode ?? "",
    city: shop?.city ?? "",
    latitude: shop?.latitude ?? null,
    longitude: shop?.longitude ?? null,
    accessInstructions: shop?.accessInstructions ?? "",
    contactPhone: shop?.contactPhone ?? "",
    zoneId: shop?.zoneId ?? "",
  };
}

function toInput(values: Values): CreateShopInput {
  return {
    name: values.name.trim(),
    address: values.address.trim(),
    postalCode: values.postalCode.trim() || null,
    city: values.city.trim() || null,
    latitude: values.latitude,
    longitude: values.longitude,
    accessInstructions: values.accessInstructions.trim() || null,
    contactPhone: values.contactPhone.trim() || null,
    zoneId: values.zoneId,
  };
}

/** Lot 2, demande 1 : création ou modification d'une boutique (nom, adresse, consignes d'accès, tournée). */
function ShopDialog({ shop, open, onOpenChange }: { shop?: ShopRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [values, setValues] = useState<Values>(() => initialValues(shop));
  const [error, setError] = useState<string | null>(null);
  const zones = useZones(open);
  const create = useCreateShop();
  const update = useUpdateShop(shop?.id ?? "");
  const pending = create.isPending || update.isPending;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!values.name.trim()) return setError("Nom de la boutique : obligatoire.");
    if (!values.address.trim()) return setError("Adresse : obligatoire.");
    if (!values.zoneId) return setError("Choisissez la tournée de la boutique.");
    setError(null);
    const input = toInput(values);
    const done = {
      onSuccess: () => {
        toast.success(shop ? "Boutique enregistrée" : "Boutique créée", {
          description: shop ? undefined : "Créez maintenant le compte vendeuse de sa tablette.",
        });
        onOpenChange(false);
        if (!shop) setValues(initialValues());
      },
      onError: (failure: Error) => setError(failure.message),
    };
    if (shop) update.mutate(input, done);
    else create.mutate(input, done);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{shop ? `Modifier ${shop.name}` : "Nouvelle boutique"}</DialogTitle>
          <DialogDescription>
            La boutique reçoit chaque matin les envois du laboratoire. Ce n&apos;est pas un client : elle ne commande pas et ne reçoit pas de facture.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" data-testid="shop-form">
          <FormField label="Nom de la boutique" required>
            <Input value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} placeholder="Centre-ville" />
          </FormField>
          <AddressFieldsGroup
            addressLabel="Adresse"
            required
            hidePreview
            values={{ address: values.address, city: values.city, postalCode: values.postalCode }}
            onChange={(next) => setValues((current) => ({ ...current, ...next }))}
            onCoordinates={(coords) => setValues((current) => ({ ...current, ...coords }))}
          />
          <FormField label="Tournée" hint="La boutique est livrée le matin de cette tournée." required>
            <Select value={values.zoneId || undefined} onValueChange={(zoneId) => setValues((current) => ({ ...current, zoneId }))}>
              <SelectTrigger aria-label="Tournée" data-testid="shop-zone">
                <SelectValue placeholder="Choisir la tournée" />
              </SelectTrigger>
              <SelectContent>
                {(zones.data ?? []).filter((zone) => zone.active || zone.id === values.zoneId).map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Consignes d'accès" hint="Lues par le livreur à l'arrêt (code, porte, horaires). 500 caractères au plus.">
            <textarea
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={values.accessInstructions}
              maxLength={500}
              onChange={(event) => setValues((current) => ({ ...current, accessInstructions: event.target.value }))}
            />
          </FormField>
          <FormField label="Téléphone de la boutique">
            <Input type="tel" value={values.contactPhone} onChange={(event) => setValues((current) => ({ ...current, contactPhone: event.target.value }))} />
          </FormField>
          {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" variant="brand" loading={pending}>{shop ? "Enregistrer" : "Créer la boutique"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const SELLER_STATUS: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Désactivé",
  SUSPENDED: "Suspendu",
  PENDING_VERIFICATION: "Invitation en attente",
};

function ShopCard({ shop, canManage }: { shop: ShopRow; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateShop(shop.id);
  return (
    <Card data-testid={`shop-${shop.name}`} className={shop.active ? undefined : "opacity-70"}>
      <CardHeader className="space-y-1 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="h-5 w-5 text-brand" aria-hidden /> {shop.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            {shop.active ? <Badge variant="success">Active</Badge> : <Badge variant="outline">Désactivée</Badge>}
            {canManage ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} aria-label={`Modifier ${shop.name}`}>
                <Pencil className="h-4 w-4" /> Modifier
              </Button>
            ) : null}
          </div>
        </div>
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{[shop.address, [shop.postalCode, shop.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Tournée : {shop.zoneName ?? "aucune"} · livrée le matin
          {shop.latitude === null ? " · position à régler (adresse non reconnue)" : ""}
        </p>
        {shop.accessInstructions ? <p className="text-sm text-muted-foreground">Consignes : {shop.accessInstructions}</p> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium">Compte vendeuse (tablette)</p>
          {shop.sellers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun compte : créez-en un pour la tablette du magasin.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm" data-testid={`shop-sellers-${shop.name}`}>
              {shop.sellers.map((seller) => (
                <li key={seller.id} className="flex flex-wrap items-center gap-2">
                  <span>{seller.firstName} {seller.lastName}</span>
                  <span className="text-muted-foreground">{seller.email}</span>
                  <Badge variant="outline">{SELLER_STATUS[seller.status] ?? seller.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {shop.active ? <CreateUserDialog shop={{ id: shop.id, name: shop.name }} triggerLabel="Créer un compte vendeuse" /> : null}
            <Button
              variant="outline"
              loading={update.isPending}
              onClick={() =>
                update.mutate(
                  { active: !shop.active },
                  { onSuccess: () => toast.success(shop.active ? "Boutique désactivée" : "Boutique réactivée"), onError: (failure) => toast.error(failure.message) }
                )
              }
            >
              {shop.active ? "Désactiver" : "Réactiver"}
            </Button>
          </div>
        ) : null}
      </CardContent>
      {canManage ? <ShopDialog key={`${shop.id}-${editing}`} shop={shop} open={editing} onOpenChange={setEditing} /> : null}
    </Card>
  );
}

/** Lot 2, demande 1 : boutiques de l'entreprise et comptes vendeuse de leurs tablettes. */
export function ShopsContent() {
  const shops = useShops();
  const { can } = usePermissions();
  const canManage = can("shops:manage");
  const [creating, setCreating] = useState(false);
  if (shops.isLoading && !shops.data) return <PageSkeleton />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Boutiques</h1>
          <p className="mt-1 text-muted-foreground">Les magasins de l&apos;entreprise : ils reçoivent chaque matin les envois du laboratoire.</p>
        </div>
        {canManage ? (
          <Button variant="brand" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nouvelle boutique
          </Button>
        ) : null}
      </div>
      {shops.error ? <p role="alert" className="text-sm text-error">{shops.error.message}</p> : null}
      {shops.data && shops.data.length === 0 ? (
        <EmptyState icon={Store} title="Aucune boutique" description="Créez la première boutique, puis le compte vendeuse de sa tablette." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(shops.data ?? []).map((shop) => <ShopCard key={shop.id} shop={shop} canManage={canManage} />)}
        </div>
      )}
      {canManage ? <ShopDialog key={`new-${creating}`} open={creating} onOpenChange={setCreating} /> : null}
    </div>
  );
}
