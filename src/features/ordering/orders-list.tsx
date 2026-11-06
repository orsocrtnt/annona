"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import type { PortalOrderSummary } from "@/domains/order/merchant-order.types";
import { useOrderHistory, usePortalCatalog, useUpcomingOrders } from "@/features/ordering/hooks";
import { OrderCard } from "@/features/ordering/order-card";
import { ReorderDialog } from "@/features/ordering/reorder-dialog";
import { useOrderActions } from "@/features/ordering/use-order-actions";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

const t = fr.order;

/** CLI-07 : commandes à venir et historique des semaines passées, avec « Recommander » (CLI-08). */
export function OrdersList() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") === "history" ? "history" : "upcoming";
  const upcoming = useUpcomingOrders();
  const history = useOrderHistory();
  const catalog = usePortalCatalog();
  const actions = useOrderActions();
  const [reordering, setReordering] = useState<PortalOrderSummary | null>(null);
  const timeZone = catalog.data?.rules.timeZone ?? "Europe/Paris";

  const setTab = (value: "upcoming" | "history") => router.replace(value === "history" ? "/portal/orders?tab=history" : "/portal/orders", { scroll: false });

  const loading = tab === "upcoming" ? upcoming.isLoading : history.isLoading;
  const error = tab === "upcoming" ? upcoming.error : history.error;
  const orders = tab === "upcoming" ? upcoming.data?.orders ?? [] : (history.data?.pages ?? []).flatMap((page) => page.orders);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.myOrders}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.historyHint}</p>
      </div>
      <div className="inline-flex rounded-full border bg-muted p-1" role="tablist" aria-label={t.myOrders}>
        {(["upcoming", "history"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "min-h-10 rounded-full px-5 text-sm font-medium transition-colors",
              tab === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {value === "upcoming" ? t.upcoming : t.history}
          </button>
        ))}
      </div>

      {loading ? (
        <PageSkeleton />
      ) : error ? (
        <Alert variant="destructive"><AlertDescription>{error instanceof Error ? error.message : fr.common.loadError}</AlertDescription></Alert>
      ) : orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {tab === "upcoming" ? t.noUpcoming : t.noHistory}
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} timeZone={timeZone} onReorder={setReordering} onToCart={actions.toCart} onEdit={actions.edit} />
          ))}
        </ul>
      )}

      {tab === "history" && history.hasNextPage ? (
        <Button variant="outline" size="touch" className="w-full" loading={history.isFetchingNextPage} onClick={() => history.fetchNextPage()}>
          {t.showMore}
        </Button>
      ) : null}

      <ReorderDialog order={reordering} onOpenChange={(open) => { if (!open) setReordering(null); }} />
    </div>
  );
}
