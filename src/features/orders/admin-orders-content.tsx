"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Lock, LockOpen } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeliveryDayPicker, parisDateKey } from "@/components/shared/delivery-day-picker";
import { OrderStatusBadge } from "@/features/client-portal/status-badges";
import { useAdminOrderDay } from "@/features/orders/hooks";
import { ORDER_ORIGIN_LABELS } from "@/lib/constants/order-status";
import { deadlineLabel } from "@/lib/format/delivery-date";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";
import { ADMIN_ORDER_VIEWS, type AdminOrderView } from "@/domains/order/admin-order.types";

const t = fr.adminOrders;
const ALL = "all";

/** LOCK-1 — commandes du jour (ADM-04), filtrables par client et par tournée. */
export function AdminOrdersContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const date = params.get("date") ?? parisDateKey(1);
  const merchantId = params.get("merchantId");
  const roundId = params.get("roundId");
  const rawView = params.get("view");
  const view = (ADMIN_ORDER_VIEWS as readonly string[]).includes(rawView ?? "") ? (rawView as AdminOrderView) : null;
  const day = useAdminOrderDay(date, merchantId, roundId, view);

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router]
  );

  if (day.isLoading && !day.data) return <PageSkeleton />;
  const data = day.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-muted-foreground max-md:hidden">{t.subtitle}</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t.date}</p>
            <DeliveryDayPicker
              value={date}
              label={t.date}
              onChange={(value) => update({ date: value, merchantId: null, roundId: null, view: null })}
              shortcuts={[
                { days: 0, label: t.today },
                { days: 1, label: t.tomorrow },
                { days: 2, label: t.afterTomorrow },
              ]}
            />
          </div>
          <div className="w-full space-y-1.5 sm:w-60">
            <p className="text-sm font-medium" id="filter-client">{t.client}</p>
            <Select value={merchantId ?? ALL} onValueChange={(value) => update({ merchantId: value === ALL ? null : value })}>
              <SelectTrigger aria-labelledby="filter-client"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t.allClients}</SelectItem>
                {(data?.merchants ?? []).map((merchant) => (
                  <SelectItem key={merchant.id} value={merchant.id}>{merchant.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-1.5 sm:w-64">
            <p className="text-sm font-medium" id="filter-round">{t.round}</p>
            <Select value={roundId ?? ALL} onValueChange={(value) => update({ roundId: value === ALL ? null : value })}>
              <SelectTrigger aria-labelledby="filter-round"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t.allRounds}</SelectItem>
                {(data?.rounds ?? []).map((round) => (
                  <SelectItem key={round.id} value={round.id}>
                    {round.name}{round.driverName ? ` · ${round.driverName}` : ""}
                  </SelectItem>
                ))}
                <SelectItem value="none">{t.noRound}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Lot 1, demande 6 : vue ouverte depuis un chiffre du tableau de bord. */}
          <div className="w-full space-y-1.5 sm:w-60">
            <p className="text-sm font-medium" id="filter-view">{t.view}</p>
            <Select value={view ?? ALL} onValueChange={(value) => update({ view: value === ALL ? null : value })}>
              <SelectTrigger aria-labelledby="filter-view" data-testid="filter-view"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t.views.all}</SelectItem>
                {ADMIN_ORDER_VIEWS.map((item) => (
                  <SelectItem key={item} value={item}>{t.views[item]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {day.error ? (
        <Alert variant="destructive">
          <AlertDescription>{day.error instanceof Error ? day.error.message : fr.common.loadError}</AlertDescription>
        </Alert>
      ) : null}

      {data ? (
        <>
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="day-lock-state">
            {data.closed ? <Lock className="h-4 w-4" aria-hidden /> : <LockOpen className="h-4 w-4" aria-hidden />}
            {data.closed ? fr.lock.closed(deadlineLabel(data.cutoffAt)) : fr.lock.open(deadlineLabel(data.cutoffAt))}
            <span aria-hidden>·</span>
            <span>{t.count(data.orders.length)}{data.orders.length !== data.total ? ` / ${data.total}` : ""}</span>
          </p>

          {data.orders.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {data.total === 0 ? t.empty : t.emptyFiltered}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columns.reference}</TableHead>
                  <TableHead>{t.columns.client}</TableHead>
                  <TableHead className="max-md:hidden">{t.columns.slot}</TableHead>
                  <TableHead className="max-lg:hidden">{t.columns.round}</TableHead>
                  <TableHead>{t.columns.status}</TableHead>
                  <TableHead className="max-lg:hidden">{t.columns.origin}</TableHead>
                  <TableHead className="text-right max-md:hidden">{t.columns.items}</TableHead>
                  <TableHead className="text-right">{t.columns.total}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orders.map((order) => (
                  <TableRow key={order.id} data-testid={`admin-order-${order.reference}`}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/orders/${order.id}`} prefetch={false} className="text-brand underline-offset-4 hover:underline">
                        {order.reference}
                      </Link>
                    </TableCell>
                    <TableCell>{order.merchant.name}</TableCell>
                    <TableCell className="max-md:hidden">{order.slot.label}</TableCell>
                    <TableCell className="max-lg:hidden">
                      {order.round ? `${order.round.name} · ${t.stop(order.stopSequence ?? 0)}` : <span className="text-muted-foreground">{t.noRound}</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <OrderStatusBadge status={order.status} />
                        {order.incident ? <Badge variant="error">{t.incident}</Badge> : null}
                        {order.shortage ? <Badge variant="error">{t.shortage}</Badge> : null}
                        {order.corrected ? <Badge variant="outline">{t.corrected}</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="max-lg:hidden">{ORDER_ORIGIN_LABELS[order.origin]}</TableCell>
                    <TableCell className="text-right tabular-nums max-md:hidden">{order.itemCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(order.subtotalCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      ) : null}
    </div>
  );
}
