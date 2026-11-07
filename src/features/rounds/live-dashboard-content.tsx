"use client";

import Link from "next/link";
import { CheckCircle2, ClipboardList, Clock, ImageIcon, Route, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLiveDashboard } from "@/features/rounds/hooks";
import { ROUND_COLORS, RoundsMap } from "@/features/rounds/rounds-map";
import { longDeliveryDateLabel, timeLabel } from "@/lib/format/delivery-date";
import { fr } from "@/lib/i18n/fr";

const t = fr.live;

/** TOUR-1 — tableau de bord : commandes du jour et suivi en direct des tournées (ADM-04, ADM-08, ENF-04). */
export function LiveDashboardContent() {
  const live = useLiveDashboard();
  if (live.isLoading && !live.data) return <PageSkeleton />;
  const data = live.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-muted-foreground">
            {data ? `${longDeliveryDateLabel(data.date)} · ` : ""}
            {t.subtitle}
          </p>
        </div>
        {data ? (
          <p className="text-xs text-muted-foreground" aria-live="polite" data-testid="live-refreshed">
            {t.refreshed(timeLabel(data.generatedAt))}
          </p>
        ) : null}
      </div>

      {live.error ? (
        <Alert variant="destructive">
          <AlertDescription>{live.error instanceof Error ? live.error.message : fr.common.loadError}</AlertDescription>
        </Alert>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="live-kpis">
            <StatCard label={t.orders} value={data.orders.total} icon={ClipboardList} quiet />
            <StatCard label={t.rounds} value={data.totals.rounds} icon={Route} changeLabel={t.roundsInProgress(data.totals.inProgress)} quiet />
            <StatCard label={t.delivered} value={data.totals.delivered} icon={CheckCircle2} tone="success" quiet />
            <StatCard label={t.remaining} value={data.totals.remaining} icon={Clock} quiet />
            <StatCard label={t.incidents} value={data.incidents.length} icon={TriangleAlert} tone={data.incidents.length > 0 ? "critical" : undefined} quiet />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/orders?date=${data.date}`}>{t.ordersLink}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/rounds?date=${data.date}`}>{t.manageRounds}</Link>
            </Button>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{t.roundsTitle}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {data.rounds.length === 0 ? (
                    <p className="px-6 pb-6 text-sm text-muted-foreground">{t.roundsEmpty}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.round}</TableHead>
                          <TableHead>{t.driver}</TableHead>
                          <TableHead className="min-w-40">{t.progress}</TableHead>
                          <TableHead className="max-md:hidden">{t.next}</TableHead>
                          <TableHead>{t.status}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.rounds.map((round, index) => {
                          const done = round.progress.delivered + round.progress.incidents;
                          return (
                            <TableRow key={round.id} data-testid="live-round" data-round-name={round.name}>
                              <TableCell>
                                <span className="flex items-center gap-2 font-medium">
                                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ROUND_COLORS[index % ROUND_COLORS.length] }} aria-hidden />
                                  {round.name}
                                </span>
                                <span className="text-xs text-muted-foreground">{round.slotLabel}</span>
                              </TableCell>
                              <TableCell>
                                {round.driverName ?? <span className="text-muted-foreground">{fr.rounds.noDriver}</span>}
                                {round.driverPosition ? (
                                  <span className="block text-xs text-muted-foreground">{t.positionAt(timeLabel(round.driverPosition.updatedAt))}</span>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm tabular-nums" data-testid="live-round-progress">{t.progressLabel(round.progress.delivered, round.progress.total)}</span>
                                {round.progress.incidents > 0 ? <span className="block text-xs text-error">{t.incidents} : {round.progress.incidents}</span> : null}
                                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                                  <div className="h-full rounded-full bg-success" style={{ width: `${round.progress.total ? (done / round.progress.total) * 100 : 0}%` }} />
                                </div>
                                {round.lastDeliveredAt ? (
                                  <span className="text-xs text-muted-foreground">{t.lastDelivery} : {timeLabel(round.lastDeliveredAt)}</span>
                                ) : null}
                              </TableCell>
                              <TableCell className="max-md:hidden">{round.nextStopName ?? "—"}</TableCell>
                              <TableCell>
                                <Badge variant={round.status === "COMPLETED" ? "success" : round.status === "IN_PROGRESS" ? "brand" : "outline"}>
                                  {fr.roundStatus[round.status]}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{t.incidentsTitle}</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.incidents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t.incidentsEmpty}</p>
                  ) : (
                    <ul className="divide-y" data-testid="live-incidents">
                      {data.incidents.map((incident) => (
                        <li key={incident.stopId} className="flex gap-3 py-3" data-testid="live-incident">
                          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-error" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">
                              {incident.merchantName} · {fr.incidentCodes[incident.code] ?? incident.code}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {incident.roundName}
                              {incident.driverName ? ` · ${incident.driverName}` : ""} · {timeLabel(incident.at)}
                              {incident.stopStatus === "DELIVERED" ? ` · ${t.deliveredAfter}` : ""}
                            </p>
                            {incident.comment ? <p className="mt-1 text-sm">« {incident.comment} »</p> : null}
                          </div>
                          {incident.hasPhoto ? (
                            <a
                              href={`/api/stops/${encodeURIComponent(incident.stopId)}/photo`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0"
                              aria-label={t.photoAlt(incident.merchantName)}
                              data-testid="live-incident-photo"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- photo privée servie par l'API, hors optimiseur d'images */}
                              <img
                                src={`/api/stops/${encodeURIComponent(incident.stopId)}/photo`}
                                alt={t.photoAlt(incident.merchantName)}
                                className="h-16 w-16 rounded-lg border object-cover"
                                loading="lazy"
                              />
                              <span className="sr-only">
                                <ImageIcon aria-hidden /> {t.photo}
                              </span>
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <aside className="space-y-2 xl:sticky xl:top-20 xl:self-start" aria-label={t.map}>
              <h2 className="text-lg font-semibold">{t.map}</h2>
              <p className="text-xs text-muted-foreground">{t.mapHint}</p>
              <div className="overflow-hidden rounded-xl border">
                <RoundsMap
                  depot={data.depot}
                  selectedRoundId={null}
                  height={480}
                  rounds={data.rounds.map((round, index) => ({
                    id: round.id,
                    name: round.name,
                    color: ROUND_COLORS[index % ROUND_COLORS.length]!,
                    driverName: round.driverName,
                    driverPosition: round.driverPosition,
                    stops: round.stops,
                  }))}
                />
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
