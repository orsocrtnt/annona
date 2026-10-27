"use client";

import { useParams } from "next/navigation";
import { AlertTriangle, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useAdminCompany } from "@/features/admin/hooks";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

const STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspendue" },
  { value: "TRIAL", label: "Essai" },
] as const;
const SUBSCRIPTION_STATUSES: Record<string, string> = {
  PENDING_PAYMENT: "En attente de paiement",
  ACTIVE: "Actif",
  PAST_DUE: "Impayé",
  RESTRICTED: "Restreint",
  READ_ONLY: "Lecture seule",
  CANCEL_AT_PERIOD_END: "Résiliation programmée",
  CANCELLED: "Résilié",
  EXPIRED: "Expiré",
};
const FOLLOW_UP: Record<string, string> = {
  CURRENT: "À jour",
  REMIND: "À relancer",
  ENDING: "Résiliation en cours",
  STOPPED: "Ne paie plus",
};
const KINDS: Record<string, string> = { COMMERCIAL: "Commercial", PILOT: "Pilote", LEGACY: "Historique" };
const statusLabel = Object.fromEntries(STATUSES.map((item) => [item.value, item.label]));
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });
const euroFormat = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function text(value: string | null | undefined) {
  return value?.trim() ? value : "—";
}

function date(value: string | null | undefined) {
  return value ? dateFormat.format(new Date(value)) : "—";
}

function euros(cents: number) {
  return euroFormat.format(cents / 100);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const { data: company, isLoading, error } = useAdminCompany(id);

  if (isInitialQueryLoading(isLoading, company)) return <PageSkeleton />;

  if (error instanceof Error && error.message === "Entreprise introuvable") {
    return <EmptyState icon={Building2} title="Entreprise introuvable" description="Cette entreprise est absente de la liste plateforme." />;
  }

  if (error || !company) {
    return <EmptyState icon={AlertTriangle} title="Entreprise indisponible" description="Impossible de charger cette entreprise." />;
  }

  const subscription = company.subscription;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{"Lecture seule. Identité, abonnement et chiffre d'affaires des livraisons."}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Identité</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Raison sociale" value={text(company.legalName)} />
          <Field label="Slug" value={company.slug} />
          <div>
            <dt className="text-sm text-muted-foreground">Statut</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              <Badge variant={company.status === "ACTIVE" ? "success" : company.status === "TRIAL" ? "brand" : "secondary"}>
                {statusLabel[company.status]}
              </Badge>
              {company.isDemo ? <Badge variant="secondary">Démonstration</Badge> : null}
            </dd>
          </div>
          <Field label="Créée" value={date(company.createdAt)} />
          <Field label="E-mail" value={text(company.email)} />
          <Field label="Téléphone" value={text(company.phone)} />
          <Field label="Adresse" value={text(company.address)} />
          <Field label="Ville" value={text(company.city)} />
          <Field label="Pays" value={text(company.country)} />
          <Field label="SIREN" value={text(company.siren)} />
          <Field label="SIRET" value={text(company.siret)} />
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Facturation</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Adresse de facturation" value={text(company.billingAddress)} />
          <Field label="Code postal" value={text(company.billingPostalCode)} />
          <Field label="Ville de facturation" value={text(company.billingCity)} />
          <Field label="Administrateur" value={company.admin ? company.admin.name : "—"} />
          <Field label="E-mail administrateur" value={text(company.admin?.email)} />
          <Field label="Téléphone administrateur" value={text(company.admin?.phone)} />
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Activité</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Utilisateurs" value={String(company.userCount)} />
          <Field label="Livraisons" value={String(company.deliveryCount)} />
          <Field label="CA encaissé" value={euros(company.revenue.paidCents)} />
          <Field label="CA en attente" value={euros(company.revenue.pendingCents)} />
          <Field label="CA en retard" value={euros(company.revenue.overdueCents)} />
        </dl>
        <p className="text-sm text-muted-foreground">{"Le chiffre d'affaires est la somme des factures de livraison, pas le prix de l'abonnement."}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Abonnement</h2>
        {subscription ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" value={KINDS[subscription.kind] ?? subscription.kind} />
            <Field label="Formule" value={subscription.plan ? subscription.plan.name : "Non déterminée"} />
            <div>
              <dt className="text-sm text-muted-foreground">Statut</dt>
              <dd className="mt-1">{SUBSCRIPTION_STATUSES[subscription.status] ?? subscription.status}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Suivi</dt>
              <dd className="mt-1">
                <Badge variant={subscription.followUp === "CURRENT" ? "success" : subscription.followUp === "REMIND" ? "brand" : "secondary"}>
                  {FOLLOW_UP[subscription.followUp]}
                </Badge>
              </dd>
            </div>
            <Field label="Périodicité" value={subscription.interval === "ANNUAL" ? "Annuel" : subscription.interval === "MONTHLY" ? "Mensuel" : "—"} />
            <Field label="HT enregistré" value={euros(subscription.amountCents)} />
            <Field label="Début de période" value={date(subscription.periodStart)} />
            <Field label="Fin de période" value={date(subscription.periodEnd)} />
            <Field label="Résiliation en fin de période" value={subscription.cancelAtPeriodEnd ? "Oui" : "Non"} />
            <Field label="Arrêté le" value={date(subscription.endedAt)} />
            <Field label="Fin de découverte" value={date(subscription.premiumDiscoveryEndsAt)} />
            <Field label="Commandes" value={`${subscription.orders.consumed} / ${subscription.orders.included} (+${subscription.orders.overage})`} />
            <Field label="Livreurs supplémentaires" value={String(subscription.seats.DRIVER_SEAT)} />
            <Field label="Admins supplémentaires" value={String(subscription.seats.ADMIN_SEAT)} />
            <Field label="Dispatchers supplémentaires" value={String(subscription.seats.DISPATCHER_SEAT)} />
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Options</dt>
              <dd className="mt-1">
                {subscription.options.length === 0
                  ? "Aucune option"
                  : subscription.options.map((option) => `${option.name} × ${option.quantity} (${euros(option.unitPriceCents)})`).join(", ")}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun abonnement enregistré.</p>
        )}
      </section>
    </div>
  );
}
