"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Block,
  Empty,
  Field,
  FieldGrid,
  LinkButton,
  Meter,
  Stat,
  StatusBadge,
  Unavailable,
} from "@/features/admin/company/company-file-blocks";
import {
  COMPANY_STATUS_LABELS,
  FOLLOW_UP_LABELS,
  ROLE_LABELS_PLURAL,
  ROLE_LABELS_SINGULAR,
  SUBSCRIPTION_KIND_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  USER_STATUS_LABELS,
  count,
  euros,
  formatDate,
  formatDateTime,
  formatEndInclusive,
  formatMonth,
  plural,
  text,
} from "@/features/admin/company/company-file-format";
import { CHART_COLORS, DailyLineChart, type DailyLine } from "@/features/admin/home/daily-line-chart";
import { HomeCard } from "@/features/admin/home/home-card";
import { UNLIMITED_MONTHLY_ORDERS } from "@/domains/billing/subscription-view.types";
import type { PlatformCompanyFile } from "@/domains/admin/company-file.service";
import { AccessToggleButton } from "@/features/admin/access/access-toggle-button";

const LINES: ReadonlyArray<DailyLine<"orders" | "delivered">> = [
  { key: "orders", label: "Commandes créées", short: "Commandes", ...CHART_COLORS.blue },
  { key: "delivered", label: "Livraisons livrées", short: "Livrées", ...CHART_COLORS.green },
];

type Company = PlatformCompanyFile;

function filtered(path: string, q: string) {
  return `${path}?q=${encodeURIComponent(q)}`;
}

function IdentityBlock({ company }: { company: Company }) {
  return (
    <Block id="company-identity" title="Identité">
      <FieldGrid>
        <Field label="Nom">{company.name}</Field>
        <Field label="Raison sociale">{text(company.legalName)}</Field>
        <Field label="Statut">
          <StatusBadge status={company.status} label={COMPANY_STATUS_LABELS[company.status] ?? company.status} />
        </Field>
        <Field label="Démonstration">{company.isDemo ? "Oui" : "Non"}</Field>
        <Field label="Créée le">{formatDate(company.createdAt)}</Field>
        <Field label="Slug">{company.slug}</Field>
        <Field label="E-mail">{text(company.email)}</Field>
        <Field label="Téléphone">{text(company.phone)}</Field>
        <Field label="Adresse">{text(company.address)}</Field>
        <Field label="Ville">{text(company.city)}</Field>
        <Field label="Pays">{text(company.country)}</Field>
        <Field label="SIREN">{text(company.siren)}</Field>
        <Field label="SIRET">{text(company.siret)}</Field>
      </FieldGrid>
    </Block>
  );
}

function SubscriptionBlock({ company }: { company: Company }) {
  const subscription = company.subscription;
  return (
    <Block id="company-subscription" title="Abonnement" hint="Formule, options et dates de la période en cours.">
      {!subscription ? (
        <Empty>Aucun abonnement enregistré.</Empty>
      ) : (
        <FieldGrid>
          <Field label="Formule">{subscription.plan ? subscription.plan.name : "Non déterminée"}</Field>
          <Field label="Type">{SUBSCRIPTION_KIND_LABELS[subscription.kind] ?? subscription.kind}</Field>
          <Field label="Statut">{SUBSCRIPTION_STATUS_LABELS[subscription.status] ?? subscription.status}</Field>
          <Field label="Suivi">
            <Badge variant={subscription.followUp === "CURRENT" ? "success" : subscription.followUp === "REMIND" ? "brand" : "secondary"}>
              {FOLLOW_UP_LABELS[subscription.followUp]}
            </Badge>
          </Field>
          <Field label="Périodicité">
            {subscription.interval === "ANNUAL" ? "Annuel" : subscription.interval === "MONTHLY" ? "Mensuel" : "—"}
          </Field>
          <Field label="HT enregistré">{euros(subscription.amountCents)}</Field>
          <Field label="Début de période">{formatDate(subscription.periodStart)}</Field>
          <Field label="Fin de période">{formatDate(subscription.periodEnd)}</Field>
          <Field label="Résiliation en fin de période">{subscription.cancelAtPeriodEnd ? "Oui" : "Non"}</Field>
          <Field label="Arrêté le">{formatDate(subscription.endedAt)}</Field>
          <Field label="Fin de découverte">{formatDate(subscription.premiumDiscoveryEndsAt)}</Field>
          <Field label="Places ajoutées">
            {`${plural(subscription.seats.DRIVER_SEAT, "livreur", "livreurs")}, ${plural(subscription.seats.ADMIN_SEAT, "admin", "admins")}, ${plural(subscription.seats.DISPATCHER_SEAT, "dispatcher", "dispatchers")}`}
          </Field>
          <Field label="Options actives" wide>
            {subscription.options.length === 0 ? (
              "Aucune option"
            ) : (
              <ul className="flex flex-wrap gap-2">
                {subscription.options.map((option) => (
                  <li key={option.code}>
                    <Badge variant="brand">
                      {option.name} × {option.quantity} ({euros(option.unitPriceCents)})
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Field>
        </FieldGrid>
      )}
    </Block>
  );
}

function ConsumptionBlock({ company }: { company: Company }) {
  const subscription = company.subscription;
  const users = company.activity.users;
  const drivers = users?.byRole.find((entry) => entry.role === "DRIVER")?.seated ?? 0;
  const orders = subscription?.orders;
  return (
    <Block id="company-consumption" title="Consommation" hint="Commandes de la période d'abonnement et livreurs comptés dans l'offre.">
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-foreground">Commandes de la période</p>
          {!subscription ? (
            <p className="mt-1 text-sm text-muted-foreground">Sans abonnement : rien n&apos;est décompté.</p>
          ) : !orders?.periodStartsAt ? (
            <p className="mt-1 text-sm text-muted-foreground">Aucune période de consommation ouverte : rien n&apos;est décompté.</p>
          ) : orders.included >= UNLIMITED_MONTHLY_ORDERS ? (
            <p className="mt-1 text-sm text-foreground">
              <span className="text-2xl font-bold tabular-nums">{count(orders.consumed)}</span>{" "}
              <span className="text-muted-foreground">
                {`commandes du ${formatDate(orders.periodStartsAt)} au ${formatEndInclusive(orders.periodEndsAt)} · illimitées`}
              </span>
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {count(orders.consumed)} <span className="text-base font-semibold text-muted-foreground">/ {count(orders.included)} incluses</span>
              </p>
              <Meter value={orders.consumed} max={orders.included} label="Commandes consommées sur les commandes incluses" />
              <p className="text-xs text-muted-foreground">
                Du {formatDate(orders.periodStartsAt)} au {formatEndInclusive(orders.periodEndsAt)}
                {orders.overage > 0 ? ` · ${plural(orders.overage, "commande", "commandes")} au-delà du forfait` : " · aucun dépassement"}
              </p>
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Livreurs</p>
          {!users ? (
            <div className="mt-2"><Unavailable what="Comptes de l'entreprise illisibles." /></div>
          ) : !subscription?.drivers.known ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {plural(drivers, "livreur actif ou invité", "livreurs actifs ou invités")} · formule inconnue, pas de plafond à comparer.
            </p>
          ) : subscription.drivers.unlimited ? (
            <p className="mt-1 text-sm text-foreground">
              <span className="text-2xl font-bold tabular-nums">{count(drivers)}</span>{" "}
              <span className="text-muted-foreground">livreurs · illimité dans cette formule</span>
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {count(drivers)} <span className="text-base font-semibold text-muted-foreground">/ {count(subscription.drivers.limit ?? 0)} prévus</span>
              </p>
              <Meter value={drivers} max={subscription.drivers.limit ?? 0} label="Livreurs actifs sur les livreurs prévus" />
              <p className="text-xs text-muted-foreground">Comptes livreur actifs ou en attente de validation.</p>
            </div>
          )}
        </div>
      </div>
    </Block>
  );
}

function DeliveriesBlock({ company }: { company: Company }) {
  const deliveries = company.activity.deliveries;
  return (
    <Block id="company-deliveries" title="Livraisons du mois" hint={`${formatMonth(company.activity.month.startsAt)}, à l'heure de Paris.`}>
      {!deliveries ? (
        <Unavailable what="Livraisons du mois illisibles." />
      ) : deliveries.created === 0 && deliveries.delivered === 0 ? (
        <Empty>Aucune livraison ce mois-ci.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Livrées ce mois" value={count(deliveries.delivered)} tone="brand" note="terminées « Livrée » dans le mois" />
          <Stat label="Créées ce mois" value={count(deliveries.created)} />
          <Stat label="En cours" value={count(deliveries.inProgress)} note="parmi les créées" />
          <Stat label="Terminées" value={count(deliveries.done)} note="livrées, facturées ou payées" />
          <Stat label="Échouées" value={count(deliveries.failed)} tone={deliveries.failed > 0 ? "error" : undefined} />
          <Stat label="Annulées" value={count(deliveries.cancelled)} />
        </div>
      )}
    </Block>
  );
}

function InvoicesBlock({ company }: { company: Company }) {
  const invoices = company.activity.invoices;
  return (
    <Block
      id="company-invoices"
      title="Factures de livraison"
      hint="Factures de l'entreprise à ses clients, pas l'abonnement TutelLiv."
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{`Émises en ${formatMonth(company.activity.month.startsAt)}`}</p>
          <div className="mt-2">
            {!invoices ? (
              <Unavailable what="Factures du mois illisibles." />
            ) : invoices.count === 0 ? (
              <Empty>Aucune facture émise ce mois-ci.</Empty>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Factures" value={count(invoices.count)} note="hors brouillons et annulées" />
                <Stat label="Payé" value={euros(invoices.paidCents)} tone="brand" />
                <Stat label="En attente" value={euros(invoices.pendingCents)} />
                <Stat label="En retard" value={euros(invoices.overdueCents)} tone={invoices.overdueCents > 0 ? "error" : undefined} />
              </div>
            )}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Depuis le début</p>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-muted-foreground">CA encaissé</dt>
              <dd className="font-semibold tabular-nums text-foreground">{euros(company.revenue.paidCents)}</dd>
            </div>
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-muted-foreground">CA en attente</dt>
              <dd className="font-semibold tabular-nums text-foreground">{euros(company.revenue.pendingCents)}</dd>
            </div>
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-muted-foreground">CA en retard</dt>
              <dd className="font-semibold tabular-nums text-foreground">{euros(company.revenue.overdueCents)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            {"Le chiffre d'affaires est la somme des factures de livraison, pas le prix de l'abonnement."}
          </p>
        </div>
      </div>
    </Block>
  );
}

function UsersBlock({ company }: { company: Company }) {
  const users = company.activity.users;
  return (
    <Block
      id="company-users"
      title="Utilisateurs"
      hint={`${plural(company.userCount, "compte rattaché", "comptes rattachés")}, par rôle, avec la dernière connexion.`}
      action={company.userCount > 0 ? <LinkButton href={filtered("/admin/users", company.name)}>Voir dans Utilisateurs</LinkButton> : undefined}
    >
      {!users ? (
        <Unavailable what="Comptes de l'entreprise illisibles." />
      ) : users.byRole.length === 0 ? (
        <Empty>Aucun utilisateur rattaché à cette entreprise.</Empty>
      ) : (
        <div className="space-y-5">
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {users.byRole.map((entry) => (
              <li key={entry.role} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                <span className="text-sm font-semibold text-foreground">{ROLE_LABELS_PLURAL[entry.role]}</span>
                <span className="text-sm tabular-nums text-foreground">
                  {count(entry.total)}
                  {entry.seated !== entry.total && <span className="text-muted-foreground">{` (${count(entry.seated)} actifs)`}</span>}
                </span>
                <span className="w-full text-xs text-muted-foreground">
                  {entry.lastLoginAt ? `Dernière connexion : ${formatDateTime(entry.lastLoginAt)}` : "Aucune connexion enregistrée"}
                </span>
              </li>
            ))}
          </ul>
          <div>
            <p className="text-sm font-semibold text-foreground">Équipe (hors clients)</p>
            {users.team.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">Aucun membre d&apos;équipe : seuls des clients sont rattachés.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {users.team.map((member) => (
                  <li key={member.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{member.name}</span>
                      <Badge variant="secondary">{ROLE_LABELS_SINGULAR[member.role]}</Badge>
                      {member.status !== "ACTIVE" && <Badge variant="outline">{USER_STATUS_LABELS[member.status] ?? member.status}</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground sm:text-right">
                      {member.lastLoginAt ? `Connecté le ${formatDateTime(member.lastLoginAt)}` : "Jamais connecté"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {users.teamTruncated && (
              <p className="mt-2 text-xs text-muted-foreground">Les 20 dernières connexions seulement : la liste complète est dans Utilisateurs.</p>
            )}
          </div>
        </div>
      )}
    </Block>
  );
}

function SupportBlock({ company }: { company: Company }) {
  const { support, incidents } = company.activity;
  return (
    <Block id="company-support" title="Support et incidents" hint="Tickets ouverts ou en cours, incidents encore ouverts.">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Incidents ouverts</p>
            {!incidents ? (
              <div className="mt-2"><Unavailable what="Incidents illisibles." /></div>
            ) : (
              <p className={incidents.open > 0 ? "mt-1 text-2xl font-bold tabular-nums text-[#c43b2f] dark:text-error" : "mt-1 text-sm text-muted-foreground"}>
                {incidents.open > 0 ? count(incidents.open) : "Aucun incident ouvert."}
              </p>
            )}
          </div>
          {incidents && incidents.open > 0 && <LinkButton href={filtered("/admin/incidents", company.name)}>Voir les incidents</LinkButton>}
        </div>
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Tickets support</p>
              {!support ? null : (
                <p className={support.open > 0 ? "mt-1 text-2xl font-bold tabular-nums text-foreground" : "mt-1 text-sm text-muted-foreground"}>
                  {support.open > 0 ? count(support.open) : "Aucun ticket ouvert."}
                </p>
              )}
            </div>
            {support && support.open > 0 && <LinkButton href={filtered("/admin/support", company.name)}>Voir les tickets</LinkButton>}
          </div>
          {!support ? (
            <div className="mt-2"><Unavailable what="Tickets support illisibles." /></div>
          ) : (
            support.latest.length > 0 && (
              <ul className="mt-3 divide-y divide-border">
                {support.latest.map((ticket) => (
                  <li key={ticket.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0 truncate text-sm text-foreground">{ticket.subject}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={ticket.priority === "URGENT" || ticket.priority === "HIGH" ? "warning" : "secondary"}>
                        {TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                      </Badge>
                      {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status} · {formatDate(ticket.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </div>
    </Block>
  );
}

function BillingContactBlock({ company }: { company: Company }) {
  return (
    <Block id="company-billing" title="Facturation et contact">
      <FieldGrid>
        <Field label="Adresse de facturation">{text(company.billingAddress)}</Field>
        <Field label="Code postal">{text(company.billingPostalCode)}</Field>
        <Field label="Ville de facturation">{text(company.billingCity)}</Field>
        <Field label="Administrateur">{company.admin ? company.admin.name : "—"}</Field>
        <Field label="E-mail administrateur">{text(company.admin?.email)}</Field>
        <Field label="Téléphone administrateur">{text(company.admin?.phone)}</Field>
      </FieldGrid>
    </Block>
  );
}

/** ADMIN-ESPACE lot 3 : fiche entreprise complète, en lecture seule. */
export function CompanyFileView({ company }: { company: Company }) {
  const { activity } = company;
  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <Link
          href="/companies"
          className="inline-flex min-h-11 items-center gap-2 rounded-full pr-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Entreprises
        </Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Fiche entreprise</p>
          <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{company.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge status={company.status} label={COMPANY_STATUS_LABELS[company.status] ?? company.status} />
            {company.isDemo && <Badge variant="secondary">Démonstration</Badge>}
            {company.subscription?.plan && <Badge variant="brand">{company.subscription.plan.name}</Badge>}
            <span>{`Créée le ${formatDate(company.createdAt)}`}</span>
          </div>
        </div>
        {!company.isDemo && (
          <AccessToggleButton kind="company" id={company.id} name={company.name} status={company.status} />
        )}
      </header>

      <div className="grid gap-5 xl:grid-cols-2">
        <ConsumptionBlock company={company} />
        <DeliveriesBlock company={company} />
      </div>

      {activity.series ? (
        <DailyLineChart
          series={activity.series}
          lines={LINES}
          title="30 derniers jours"
          subtitle="Commandes créées et livraisons livrées de cette entreprise, jours à l'heure de Paris."
          titleId="company-chart-title"
          tableCaption="Commandes créées et livraisons livrées par jour, 30 derniers jours, pour cette entreprise"
        />
      ) : (
        <HomeCard aria-labelledby="company-chart-title">
          <h2 id="company-chart-title" className="text-lg font-bold tracking-tight text-foreground">30 derniers jours</h2>
          <div className="mt-4"><Unavailable what="Courbe de l'entreprise illisible." /></div>
        </HomeCard>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <SupportBlock company={company} />
        <InvoicesBlock company={company} />
      </div>

      <UsersBlock company={company} />

      <div className="grid gap-5 xl:grid-cols-2">
        <SubscriptionBlock company={company} />
        <IdentityBlock company={company} />
      </div>

      <BillingContactBlock company={company} />
    </div>
  );
}
