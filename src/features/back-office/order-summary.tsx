import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPlace } from "@/lib/format/place";
import { fullDateLabel, relativeDayLabel } from "@/lib/format/relative-day";
import { isOrderOverdue } from "@/lib/orders/overdue";
import { orderProgress, type OrderProgress } from "@/lib/orders/progress";
import type { CompanyOrder } from "./types";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#f5f8f6] px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function ProgressTrack({ progress }: { progress: OrderProgress }) {
  if (progress.kind === "stopped") {
    return (
      <p
        className={cn(
          "mt-5 rounded-xl px-3 py-2.5 text-sm font-medium",
          progress.tone === "danger" ? "bg-[#fdecea] text-[#8a2a20]" : "bg-[#f1f3f2] text-foreground"
        )}
      >
        {progress.label}
      </p>
    );
  }
  return (
    <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Avancement de la commande">
      {progress.steps.map((step, index) => {
        const done = index < progress.current || (index === progress.current && index === progress.steps.length - 1);
        const current = index === progress.current && !done;
        return (
          <li key={step.key} className="min-w-0" aria-current={current ? "step" : undefined}>
            <span
              className={cn("block h-1.5 rounded-full", done ? "bg-foreground" : current ? "bg-primary" : "bg-[#e4e8e5]")}
              aria-hidden="true"
            />
            <span
              className={cn(
                "mt-2 flex items-center gap-1 text-xs",
                done || current ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {done && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}
              <span className="truncate">{step.label}</span>
              <span className="sr-only">{done ? " (terminée)" : current ? " (en cours)" : " (à venir)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * En-tête lisible d'une commande : à qui, où, quand, par qui, et où elle en est.
 * La référence reste le titre de la page (recherche, support) mais n'est plus la seule information.
 */
export function OrderSummary({ order }: { order: CompanyOrder }) {
  const delivery = order.deliveries?.[0];
  const client = order.customer
    ? `${order.customer.firstName} ${order.customer.lastName}`.trim()
    : order.customerEmail?.trim() || "Client non renseigné";
  const place = formatPlace(
    order.shippingAddress,
    [order.shippingPostalCode, order.shippingCity].filter(Boolean).join(" ")
  );
  const driver = delivery?.driver
    ? `${delivery.driver.firstName} ${delivery.driver.lastName}`.trim()
    : delivery?.driverName?.trim() || null;
  const due = order.requestedDeliveryDate;
  const late = isOrderOverdue(order.status, due);

  return (
    <section aria-label="Résumé de la commande" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xl font-semibold tracking-tight text-foreground">{client}</p>
      {place && <p className="mt-0.5 text-sm text-muted-foreground">{place}</p>}
      <dl className="mt-4 grid gap-2 sm:grid-cols-3">
        <Fact label="Livraison prévue">
          {due ? (
            <span className={cn("inline-flex items-center gap-1", late && "text-[#b3352a]")} title={fullDateLabel(due)}>
              {late && <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              {relativeDayLabel(due, undefined, { withTime: true })}
              {late && " · en retard"}
            </span>
          ) : (
            "Non précisée"
          )}
        </Fact>
        <Fact label="Livreur">{driver ?? "Pas encore assigné"}</Fact>
        <Fact label="Créée">
          <span title={fullDateLabel(order.createdAt)}>{relativeDayLabel(order.createdAt, undefined, { withTime: true })}</span>
        </Fact>
      </dl>
      <ProgressTrack progress={orderProgress(order.status, order.deliveryCategory)} />
    </section>
  );
}
