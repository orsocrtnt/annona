"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPinOff, Plus, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMerchants } from "@/features/merchants/hooks";
import { fr } from "@/lib/i18n/fr";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { cn } from "@/lib/utils";

const t = fr.merchants;
const FILTERS = [
  { value: "all", label: t.filterAll },
  { value: "active", label: t.filterActive },
  { value: "inactive", label: t.filterInactive },
] as const;

/** ADM-1 : liste des clients de l'entreprise. */
export function MerchantsContent() {
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [query, setQuery] = useState("");
  const merchants = useMerchants(status);
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return (merchants.data ?? []).filter((row) => !needle || [row.name, row.tradeName, row.city, row.address].some((value) => value?.toLocaleLowerCase("fr").includes(needle)));
  }, [merchants.data, query]);

  if (isInitialQueryLoading(merchants.isLoading, merchants.data)) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-muted-foreground max-md:hidden">{t.subtitle}</p>
        </div>
        <Button asChild variant="brand">
          <Link href="/dashboard/merchants/new"><Plus /> {t.newMerchant}</Link>
        </Button>
      </div>

      {merchants.error ? (
        <Alert variant="destructive"><AlertDescription>{merchants.error.message}</AlertDescription></Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder={t.search} aria-label={t.search} value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Statut">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={status === filter.value}
              onClick={() => setStatus(filter.value)}
              className={cn("min-h-9 rounded-md px-3 text-sm", status === filter.value ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">{(merchants.data ?? []).length === 0 ? t.empty : t.noMatch}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columns.name}</TableHead>
                  <TableHead className="max-md:hidden">{t.columns.city}</TableHead>
                  <TableHead className="max-md:hidden">{t.columns.billing}</TableHead>
                  <TableHead className="max-md:hidden">{t.columns.accounts}</TableHead>
                  <TableHead>{t.columns.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-testid="merchant-row" data-merchant={row.name}>
                    <TableCell>
                      <Link href={`/dashboard/merchants/${row.id}`} className="font-medium hover:underline">
                        {row.tradeName || row.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {row.tradeName ? `${row.name} · ` : ""}{row.address}
                      </p>
                      {!row.located ? (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-warning" title={t.notLocated}>
                          <MapPinOff className="size-3.5" aria-hidden /> {t.notLocated}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-md:hidden">{[row.postalCode, row.city].filter(Boolean).join(" ")}</TableCell>
                    <TableCell className="max-md:hidden">{t.periods[row.billingPeriod]}</TableCell>
                    <TableCell className="max-md:hidden">{t.accounts(row.userCount)}</TableCell>
                    <TableCell>
                      <Badge variant={row.active ? "success" : "secondary"}>{row.active ? fr.common.active : fr.accounts.statuses.INACTIVE}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
