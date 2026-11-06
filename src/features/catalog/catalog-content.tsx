"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProductRow } from "@/features/catalog/api";
import { CategoryPanel } from "@/features/catalog/category-panel";
import { useCategories, useProducts } from "@/features/catalog/hooks";
import { ProductDialog } from "@/features/catalog/product-dialog";
import { ProductThumb } from "@/features/catalog/product-thumb";
import { formatCents, formatVatRate } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

const t = fr.catalog;

/** Back-office catalogue (CAT-1 : ADM-02, ADM-03, PLA-04), administrateur de l'entreprise. */
export function CatalogContent() {
  const categories = useCategories();
  const products = useProducts();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = useMemo(
    () => (editingId ? products.data?.find((product) => product.id === editingId) ?? null : null),
    [editingId, products.data]
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return (products.data ?? []).filter(
      (product) =>
        (!categoryId || product.categoryId === categoryId) &&
        (!needle || product.name.toLocaleLowerCase("fr").includes(needle))
    );
  }, [products.data, categoryId, query]);

  if (isInitialQueryLoading(categories.isLoading, categories.data) || isInitialQueryLoading(products.isLoading, products.data)) {
    return <PageSkeleton />;
  }

  const openProduct = (product: ProductRow | null) => {
    setEditingId(product?.id ?? null);
    setDialogOpen(true);
  };

  const error = categories.error ?? products.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-muted-foreground max-md:hidden">{t.subtitle}</p>
        </div>
        <Button variant="brand" onClick={() => openProduct(null)} disabled={(categories.data ?? []).length === 0}>
          <Plus /> {t.newProduct}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error instanceof Error ? error.message : fr.common.loadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <CategoryPanel categories={categories.data ?? []} selectedId={categoryId} onSelect={setCategoryId} />

        <Card className="min-w-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">
              {t.products} <span className="text-sm font-normal text-muted-foreground">({rows.length})</span>
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.searchProduct}
                aria-label={t.searchProduct}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm">
                <p className="font-medium">{t.noProduct}</p>
                <p className="mt-1 text-muted-foreground">{t.noProductHint}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.columns.product}</TableHead>
                    <TableHead className="max-md:hidden">{t.columns.category}</TableHead>
                    <TableHead className="max-md:hidden">{t.columns.unit}</TableHead>
                    <TableHead className="text-right">{t.columns.basePrice}</TableHead>
                    <TableHead className="text-right max-lg:hidden">{t.columns.vat}</TableHead>
                    <TableHead className="max-lg:hidden">{t.columns.specific}</TableHead>
                    <TableHead>{t.columns.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((product) => (
                    <TableRow
                      key={product.id}
                      className="cursor-pointer"
                      onClick={() => openProduct(product)}
                      data-testid={`product-row-${product.name}`}
                    >
                      <TableCell>
                        <button
                          type="button"
                          className="flex items-center gap-3 text-left font-medium hover:underline"
                          onClick={(event) => { event.stopPropagation(); openProduct(product); }}
                        >
                          <ProductThumb productId={product.id} photoVersion={product.photoVersion} className="h-10 w-10" />
                          <span className="min-w-0">{product.name}</span>
                        </button>
                      </TableCell>
                      <TableCell className="max-md:hidden">{product.categoryName}</TableCell>
                      <TableCell className="max-md:hidden">{product.unit}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatCents(product.basePriceCents)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums max-lg:hidden">{formatVatRate(product.vatRateBasisPoints)}</TableCell>
                      <TableCell className="whitespace-nowrap max-lg:hidden">{t.specificPriceCount(product.specificPriceCount)}</TableCell>
                      <TableCell>
                        {product.active && product.categoryActive ? (
                          <Badge variant="success">{fr.common.active}</Badge>
                        ) : (
                          <Badge variant="secondary">{product.active ? t.categoryInactive : fr.common.inactive}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        categories={categories.data ?? []}
        defaultCategoryId={categoryId ?? categories.data?.[0]?.id ?? null}
        onCreated={(product) => setEditingId(product.id)}
      />
    </div>
  );
}
