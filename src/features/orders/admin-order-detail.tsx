"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProducts } from "@/features/catalog/hooks";
import { OrderStatusBadge } from "@/features/client-portal/status-badges";
import { useAdminOrder, useCancelOrder, useCorrectOrder } from "@/features/orders/hooks";
import type { AdminOrderDetail } from "@/domains/order/admin-order.types";
import { ORDER_ORIGIN_LABELS, ROUND_STATUS_LABELS } from "@/lib/constants/order-status";
import { deadlineLabel, longDeliveryDateLabel } from "@/lib/format/delivery-date";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";
import { MAX_LINE_QUANTITY } from "@/lib/validations/order";

const t = fr.adminOrders;
const h = fr.orderHistory;

type DraftLine = { productId: string; name: string; unit: string; quantity: number };

const toDraft = (order: AdminOrderDetail): DraftLine[] =>
  order.lines.map((line) => ({ productId: line.productId, name: line.name, unit: line.unit, quantity: line.quantityOrdered }));

/** LOCK-1 — détail, correction (ADM-05) et historique journalisé (RG-10) d'une commande. */
export function AdminOrderDetailView({ id }: { id: string }) {
  const order = useAdminOrder(id);
  if (order.isLoading && !order.data) return <PageSkeleton />;
  if (!order.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Alert variant="destructive">
          <AlertDescription>{order.error instanceof Error ? order.error.message : t.errors.notFound}</AlertDescription>
        </Alert>
      </div>
    );
  }
  // Après chaque correction (nouvelle ligne de journal), le formulaire repart de la commande enregistrée.
  return <OrderView key={`${order.data.history.length}:${order.data.status}`} order={order.data} />;
}

function OrderView({ order }: { order: AdminOrderDetail }) {
  const correct = useCorrectOrder(order.id);
  const cancel = useCancelOrder(order.id);
  const products = useProducts();
  const [draft, setDraft] = useState<DraftLine[]>(() => toDraft(order));
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState<string>("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const byProduct = useMemo(() => new Map(order.lines.map((line) => [line.productId, line])), [order.lines]);
  const dirty =
    draft.length !== order.lines.length || draft.some((line) => byProduct.get(line.productId)?.quantityOrdered !== line.quantity);
  const invalid = draft.length === 0 || draft.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_LINE_QUANTITY);
  const addable = (products.data ?? []).filter(
    (product) => product.active && product.categoryActive && !draft.some((line) => line.productId === product.id)
  );

  const setQuantity = (productId: string, value: string) =>
    setDraft((lines) => lines.map((line) => (line.productId === productId ? { ...line, quantity: Number(value) } : line)));
  const addLine = () => {
    const product = addable.find((row) => row.id === adding);
    if (!product) return;
    setDraft((lines) => [...lines, { productId: product.id, name: product.name, unit: product.unit, quantity: 1 }]);
    setAdding("");
  };

  const save = () =>
    correct.mutate(
      { lines: draft.map((line) => ({ productId: line.productId, quantity: line.quantity })), note: note.trim() || null },
      {
        onSuccess: () => {
          toast.success(t.saved);
          setNote("");
        },
        onError: (error) => toast.error(error.message),
      }
    );

  return (
    <div className="space-y-6">
      <BackLink date={order.deliveryDate} />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{order.reference}</h1>
          <p className="mt-1 text-muted-foreground">
            {order.merchant.name} · {longDeliveryDateLabel(order.deliveryDate)} · {order.slot.label}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <Badge variant="outline">{ORDER_ORIGIN_LABELS[order.origin]}</Badge>
        </div>
      </header>

      <dl className="grid gap-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-muted-foreground">{t.merchant}</dt><dd className="font-medium">{order.merchant.name}</dd><dd className="text-muted-foreground">{[order.merchant.address, order.merchant.city].filter(Boolean).join(", ")}</dd></div>
        <div><dt className="text-muted-foreground">{t.round}</dt><dd className="font-medium">{order.round ? `${order.round.name} · ${t.stop(order.stopSequence ?? 0)}` : t.noRound}</dd>{order.round ? <dd className="text-muted-foreground">{ROUND_STATUS_LABELS[order.round.status]}{order.round.driverName ? ` · ${order.round.driverName}` : ""}</dd> : null}</div>
        <div><dt className="text-muted-foreground">{t.cutoff}</dt><dd className="font-medium">{deadlineLabel(order.cutoffAt)}</dd></div>
        <div><dt className="text-muted-foreground">{t.lockedAt}</dt><dd className="font-medium">{order.lockedAt ? deadlineLabel(order.lockedAt) : "—"}</dd>{order.preparedAt ? <dd className="text-muted-foreground">{t.preparedAt} {deadlineLabel(order.preparedAt)}</dd> : null}</div>
      </dl>

      {order.editable && order.afterCutoff ? (
        <Alert><AlertDescription>{t.afterCutoffHint}</AlertDescription></Alert>
      ) : null}
      {!order.editable ? (
        <Alert><AlertDescription>{t.notEditable}</AlertDescription></Alert>
      ) : null}

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">{order.editable ? t.correct : t.lines}</CardTitle>
          {order.editable ? <p className="text-sm text-muted-foreground">{t.correctHint}</p> : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.product}</TableHead>
                <TableHead className="w-32">{t.ordered}</TableHead>
                <TableHead className="text-right">{t.delivered}</TableHead>
                <TableHead className="text-right max-md:hidden">{t.unitPrice}</TableHead>
                <TableHead className="text-right">{t.lineTotal}</TableHead>
                {order.editable ? <TableHead className="w-12" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.map((line) => {
                const saved = byProduct.get(line.productId);
                const shortage = saved?.quantityDelivered !== null && saved?.quantityDelivered !== undefined && saved.quantityDelivered < saved.quantityOrdered;
                return (
                  <TableRow key={line.productId} data-testid={`admin-line-${line.name}`}>
                    <TableCell>
                      <p className="font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground">{line.unit}</p>
                    </TableCell>
                    <TableCell>
                      {order.editable ? (
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={MAX_LINE_QUANTITY}
                          value={Number.isNaN(line.quantity) ? "" : line.quantity}
                          onChange={(event) => setQuantity(line.productId, event.target.value)}
                          aria-label={t.quantityOf(line.name)}
                          className="h-9 w-24 tabular-nums"
                        />
                      ) : (
                        <span className="tabular-nums">{line.quantity}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {saved?.quantityDelivered ?? "—"}
                      {shortage ? <Badge variant="error" className="ml-2">{t.shortage}</Badge> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums max-md:hidden">
                      {saved ? `${formatCents(saved.unitPriceCents)}${saved.frozen ? ` (${t.frozen})` : ""}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{saved ? formatCents(saved.unitPriceCents * line.quantity) : "—"}</TableCell>
                    {order.editable ? (
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t.remove(line.name)}
                          onClick={() => setDraft((lines) => lines.filter((row) => row.productId !== line.productId))}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <dl className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm tabular-nums">
            <div className="flex gap-2"><dt className="text-muted-foreground">{t.totalOrdered}</dt><dd className="font-semibold">{formatCents(order.subtotalCents)}</dd></div>
            {order.deliveredSubtotalCents !== order.subtotalCents ? (
              <div className="flex gap-2"><dt className="text-muted-foreground">{t.totalDelivered}</dt><dd className="font-semibold">{formatCents(order.deliveredSubtotalCents)}</dd></div>
            ) : null}
          </dl>

          {order.editable ? (
            <div className="space-y-4 border-t pt-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-full space-y-1.5 sm:w-80">
                  <p className="text-sm font-medium" id="add-product">{t.addProduct}</p>
                  <Select value={adding} onValueChange={setAdding}>
                    <SelectTrigger aria-labelledby="add-product"><SelectValue placeholder={t.chooseProduct} /></SelectTrigger>
                    <SelectContent>
                      {addable.map((product) => (
                        <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="outline" onClick={addLine} disabled={!adding}>
                  <Plus /> {fr.common.add}
                </Button>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="correction-note" className="text-sm font-medium">{t.note}</label>
                <Input id="correction-note" value={note} maxLength={300} placeholder={t.notePlaceholder} onChange={(event) => setNote(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="brand" onClick={save} loading={correct.isPending} disabled={(!dirty && !note.trim()) || invalid}>
                  {t.save}
                </Button>
                <Button variant="outline" onClick={() => setDraft(toDraft(order))} disabled={!dirty}>{t.reset}</Button>
                <Button variant="ghost" className="ml-auto text-destructive" onClick={() => setConfirmCancel(true)}>{t.cancelOrder}</Button>
              </div>
              {confirmCancel ? (
                <div className="space-y-3 rounded-xl border border-destructive/40 p-4" role="alertdialog" aria-label={t.cancelOrder}>
                  <p className="text-sm">{t.cancelConfirm}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setConfirmCancel(false)}>{t.keep}</Button>
                    <Button
                      variant="destructive"
                      loading={cancel.isPending}
                      onClick={() =>
                        cancel.mutate(note.trim() || null, {
                          onSuccess: () => {
                            toast.success(t.cancelledDone);
                            setConfirmCancel(false);
                          },
                          onError: (error) => toast.error(error.message),
                        })
                      }
                    >
                      {t.cancelOrder}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{h.title}</CardTitle></CardHeader>
        <CardContent>
          {order.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{h.empty}</p>
          ) : (
            <ol className="space-y-3" aria-label={h.title}>
              {order.history.map((entry) => (
                <li key={entry.id} className="rounded-lg border p-3 text-sm" data-testid="order-history-entry">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{h.actions[entry.action] ?? entry.action}</span>
                    {entry.afterCutoff ? <Badge variant="warning">{h.afterCutoff}</Badge> : null}
                    <span className="text-muted-foreground">{deadlineLabel(entry.at)} · {entry.actorName}</span>
                  </div>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {entry.changes.map((change) => <li key={change}>{change}</li>)}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BackLink({ date }: { date?: string }) {
  return (
    <Link
      href={date ? `/dashboard/orders?date=${date}` : "/dashboard/orders"}
      className="inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> {t.back}
    </Link>
  );
}
