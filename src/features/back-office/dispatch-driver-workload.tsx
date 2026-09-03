"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import type { CompanyDispatchSettings } from "@/lib/validations/dispatch-settings";
import { getDispatchDriverRule, getDriverCategoryLabels } from "@/lib/validations/dispatch-settings";
import { formatDriverFromParts } from "@/lib/format/person-labels";
import { Users } from "lucide-react";
import type { DriverDispatchWorkload } from "./types";

function CountBadge({ value, variant = "secondary" }: { value: number; variant?: "secondary" | "brand" }) {
  if (value === 0) {
    return <span className="text-sm text-muted-foreground">0</span>;
  }
  return <Badge variant={variant}>{value}</Badge>;
}

function DriverRow({
  driver,
  settings,
}: {
  driver: DriverDispatchWorkload;
  settings: CompanyDispatchSettings | undefined;
}) {
  const name = formatDriverFromParts(driver, null);
  const todayTotal = driver.today.standard + driver.today.courier;
  const weekTotal = driver.next7Days.standard + driver.next7Days.courier;
  const rule = settings ? getDispatchDriverRule(settings, driver.id) : null;
  const categoryLabels = getDriverCategoryLabels(rule);
  const isPaused = rule?.dispatchStatus === "PAUSED";

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="py-3 pr-4">
        <Link href={`/dashboard/drivers/${driver.id}`} className="font-medium hover:underline">
          {name}
        </Link>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {categoryLabels.map((label) => (
            <Badge key={label} variant="secondary" className="text-[10px]">
              {label}
            </Badge>
          ))}
          {isPaused && (
            <Badge variant="outline" className="text-[10px] text-amber-700">
              Pause
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          <span>{driver.assigned} assignée{driver.assigned > 1 ? "s" : ""}</span>
          <span>·</span>
          <span>{driver.inTransit} en cours</span>
        </div>
      </td>
      <td className="py-3 px-2 text-center">
        <CountBadge value={driver.today.standard} />
      </td>
      <td className="py-3 px-2 text-center">
        <CountBadge value={driver.today.courier} variant="brand" />
      </td>
      <td className="py-3 px-2 text-center font-medium text-muted-foreground">{todayTotal}</td>
      <td className="py-3 px-2 text-center">
        <CountBadge value={driver.next7Days.standard} />
      </td>
      <td className="py-3 px-2 text-center">
        <CountBadge value={driver.next7Days.courier} variant="brand" />
      </td>
      <td className="py-3 pl-2 text-center font-medium text-muted-foreground">{weekTotal}</td>
    </tr>
  );
}

export function DispatchDriverWorkload({
  drivers,
  settings,
}: {
  drivers: DriverDispatchWorkload[] | undefined;
  settings: CompanyDispatchSettings | undefined;
}) {
  if (drivers === undefined) return <PageSkeleton />;

  if (!drivers?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Charge par chauffeur</CardTitle>
          <CardDescription>Commandes et courses planifiées par livreur</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Users}
            title="Aucun chauffeur actif"
            description="Créez des comptes chauffeur dans Gestion des comptes."
          />
        </CardContent>
      </Card>
    );
  }

  const totals = drivers.reduce(
    (acc, d) => ({
      todayStandard: acc.todayStandard + d.today.standard,
      todayCourier: acc.todayCourier + d.today.courier,
      weekStandard: acc.weekStandard + d.next7Days.standard,
      weekCourier: acc.weekCourier + d.next7Days.courier,
    }),
    { todayStandard: 0, todayCourier: 0, weekStandard: 0, weekCourier: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Charge par chauffeur</CardTitle>
        <CardDescription>
          Livraisons assignées par type — aujourd&apos;hui et sur les 7 prochains jours (auj. inclus)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden space-y-3 md:block md:overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-3 pr-4 font-medium" rowSpan={2}>
                Chauffeur
              </th>
              <th className="pb-1 px-2 text-center font-medium" colSpan={3}>
                Aujourd&apos;hui
              </th>
              <th className="pb-1 px-2 text-center font-medium" colSpan={3}>
                7 prochains jours
              </th>
            </tr>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 px-2 text-center font-normal">Commande</th>
              <th className="py-2 px-2 text-center font-normal">Course</th>
              <th className="py-2 px-2 text-center font-normal">Total</th>
              <th className="py-2 px-2 text-center font-normal">Commande</th>
              <th className="py-2 px-2 text-center font-normal">Course</th>
              <th className="py-2 px-2 text-center font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => (
              <DriverRow key={driver.id} driver={driver} settings={settings} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30 text-sm font-medium">
              <td className="py-3 pr-4">Total équipe</td>
              <td className="py-3 px-2 text-center">{totals.todayStandard}</td>
              <td className="py-3 px-2 text-center">{totals.todayCourier}</td>
              <td className="py-3 px-2 text-center">
                {totals.todayStandard + totals.todayCourier}
              </td>
              <td className="py-3 px-2 text-center">{totals.weekStandard}</td>
              <td className="py-3 px-2 text-center">{totals.weekCourier}</td>
              <td className="py-3 pl-2 text-center">
                {totals.weekStandard + totals.weekCourier}
              </td>
            </tr>
          </tfoot>
        </table>
        </div>

        <div className="space-y-3 md:hidden">
          {drivers.map((driver) => {
            const weekTotal = driver.next7Days.standard + driver.next7Days.courier;
            const todayTotal = driver.today.standard + driver.today.courier;
            const name = formatDriverFromParts(driver, null);

            return (
              <div key={driver.id} className="rounded-xl border border-border p-4">
                <Link href={`/dashboard/drivers/${driver.id}`} className="font-medium hover:underline">
                  {name}
                </Link>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-muted/40 p-2">
                    <p className="text-xs text-muted-foreground">Aujourd&apos;hui</p>
                    <p className="mt-1 font-medium">
                      {todayTotal} livraison{todayTotal > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {driver.today.standard} cmd · {driver.today.courier} course
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2">
                    <p className="text-xs text-muted-foreground">7 jours</p>
                    <p className="mt-1 font-medium">
                      {weekTotal} livraison{weekTotal > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {driver.next7Days.standard} cmd · {driver.next7Days.courier} course
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
