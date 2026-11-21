"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { normalizeAllergens, type AllergenCode } from "@/domains/catalog/allergens";
import type { CategoryRow, ProductRow } from "@/domains/catalog/catalog.types";
import { AllergensField } from "@/features/catalog/allergens-field";
import { PastryFields, initialPastryFields, parsePastryFields, type PastryFieldsState } from "@/features/catalog/pastry-fields";
import { formatCents } from "@/lib/format/money";
import type { CreatePastryProductInput } from "@/lib/validations/catalog";

type PastryProduct = ProductRow & { shopPrices: Array<{ shopName: string; sizeId: string | null; priceCents: number }> };
interface PastryCatalog {
  products: PastryProduct[];
  categories: CategoryRow[];
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as { error?: string; data?: T };
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as T;
}

const KEY = ["pastry", "products"] as const;

/** Lot 2, demande 3 : fiche d'une pâtisserie saisie par le pâtissier (aucun prix). */
function PastryDialog({
  product,
  categories,
  open,
  onOpenChange,
}: {
  product: PastryProduct | null;
  categories: CategoryRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "pièce");
  const [description, setDescription] = useState(product?.description ?? "");
  const [allergens, setAllergens] = useState<AllergenCode[] | null>(product?.allergens ? normalizeAllergens(product.allergens) : null);
  const [pastry, setPastry] = useState<PastryFieldsState>(() => initialPastryFields(product));
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (input: CreatePastryProductInput) =>
      product
        ? call<ProductRow>(`/api/pastry/products/${encodeURIComponent(product.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })
        : call<ProductRow>("/api/pastry/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success(product ? "Pâtisserie enregistrée" : "Pâtisserie créée", {
        description: product ? undefined : "L'administrateur fixe son prix restaurant ; chaque boutique, son prix boutique.",
      });
      onOpenChange(false);
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError("Nom : obligatoire.");
    if (!categoryId) return setError("Choisissez une catégorie de pâtisserie.");
    const parsed = parsePastryFields(pastry, false);
    if (typeof parsed === "string") return setError(parsed);
    setError(null);
    save.mutate({
      name: name.trim(),
      categoryId,
      unit: unit.trim() || "pièce",
      description: description.trim() || null,
      pastryFormat: parsed.pastryFormat,
      ...(parsed.pastryFormat === "LARGE" ? { servings: parsed.servings } : {}),
      allergens,
      recipe: parsed.recipe,
      shelfLifeDays: parsed.shelfLifeDays,
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? `Modifier ${product.name}` : "Nouvelle pâtisserie"}</DialogTitle>
          <DialogDescription>Pas de prix ici : le prix restaurant est fixé par l&apos;administrateur, le prix boutique par chaque boutique.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" data-testid="pastry-form">
          <FormField label="Nom" required>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Fraisier" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Catégorie" required>
              <Select value={categoryId || undefined} onValueChange={setCategoryId}>
                <SelectTrigger aria-label="Catégorie">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Unité" required>
              <Input value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={40} />
            </FormField>
          </div>
          <FormField label="Description">
            <Input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} />
          </FormField>
          <PastryFields value={pastry} onChange={setPastry} withPrices={false} />
          <AllergensField value={allergens} onChange={setAllergens} />
          {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" variant="brand" loading={save.isPending}>{product ? "Enregistrer" : "Créer la pâtisserie"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function priceLine(product: PastryProduct): string {
  if (product.pastryFormat === "LARGE") {
    return product.sizes.length
      ? product.sizes.map((size) => `${size.servings} pers. : ${formatCents(size.restaurantPriceCents)} HT`).join(" · ")
      : "Aucune taille";
  }
  return `${formatCents(product.basePriceCents)} HT`;
}

/**
 * Lot 2, demandes 3 et 4 — pâtisseries du laboratoire : le pâtissier les crée et les modifie, et voit leurs
 * prix (restaurant et boutiques) sans pouvoir les changer.
 */
export function PastryProducts() {
  const catalog = useQuery({ queryKey: KEY, queryFn: () => call<PastryCatalog>("/api/pastry/products") });
  const [editing, setEditing] = useState<PastryProduct | null>(null);
  const [open, setOpen] = useState(false);
  if (catalog.isLoading && !catalog.data) return <PageSkeleton />;
  const data = catalog.data;
  const openDialog = (product: PastryProduct | null) => {
    setEditing(product);
    setOpen(true);
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mes pâtisseries</h1>
          <p className="mt-1 text-muted-foreground">Fiches, recettes et durées de vente. Les prix sont affichés pour information.</p>
        </div>
        <Button variant="brand" onClick={() => openDialog(null)} disabled={!data || data.categories.length === 0}>
          <Plus className="h-4 w-4" /> Nouvelle pâtisserie
        </Button>
      </div>
      {catalog.error ? <p role="alert" className="text-sm text-error">{catalog.error.message}</p> : null}
      {data && data.categories.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          Aucune catégorie de pâtisserie : l&apos;administrateur doit en régler une sur « Pâtisserie » dans le catalogue.
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {(data?.products ?? []).map((product) => (
          <Card key={product.id} data-testid={`pastry-${product.name}`}>
            <CardContent className="space-y-2 pt-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {product.categoryName} · {product.pastryFormat === "LARGE" ? "Gros gâteau" : "Petite pièce"} · vente {product.shelfLifeDays} jour(s)
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openDialog(product)} aria-label={`Modifier ${product.name}`}>
                  <Pencil className="h-4 w-4" /> Modifier
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.missingRestaurantPrice ? <Badge variant="warning">Prix restaurant à saisir par l&apos;administrateur</Badge> : null}
                {!product.active ? <Badge variant="outline">Inactive</Badge> : null}
              </div>
              <p className="text-sm">Prix restaurant : {priceLine(product)}</p>
              {product.shopPrices.length ? (
                <p className="text-sm text-muted-foreground">
                  Boutiques :{" "}
                  {product.shopPrices
                    .map((price) => {
                      const size = product.sizes.find((row) => row.id === price.sizeId);
                      return `${price.shopName}${size ? ` (${size.servings} pers.)` : ""} ${formatCents(price.priceCents)}`;
                    })
                    .join(" · ")}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun prix boutique pour l&apos;instant.</p>
              )}
              {product.recipe ? <p className="line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">Recette : {product.recipe}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
      {data ? <PastryDialog key={`${editing?.id ?? "new"}-${open}`} product={editing} categories={data.categories} open={open} onOpenChange={setOpen} /> : null}
    </div>
  );
}
