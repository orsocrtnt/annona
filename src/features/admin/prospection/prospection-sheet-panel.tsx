"use client";

import { AlertTriangle, BellRing, CalendarClock, FileSpreadsheet, PlugZap } from "lucide-react";
import { useAdminProspectionSheet } from "@/features/admin/hooks";
import { HomeCard, HOME_CARD_CLASS } from "@/features/admin/home/home-card";
import { formatCount, formatDay, formatParisTime, lateLabel } from "@/features/admin/prospection/prospection-format";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { cn } from "@/lib/utils";
import type { CountItem, Decision, ProspectionSheetView, Reminder } from "@/domains/admin/prospection-sheet.service";

type ReadyView = Extract<ProspectionSheetView, { status: "ready" }>;

const SHEET_DOC = "docs/operations/prospection/SHEET.md";

function SectionTitle({ id, title, hint }: { id: string; title: string; hint?: string }) {
  return (
    <div>
      <h3 id={id} className="text-lg font-bold tracking-tight text-foreground">{title}</h3>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Unconfigured({ missing, headerRow }: { missing: string[]; headerRow: number }) {
  return (
    <HomeCard aria-labelledby="sheet-unconfigured-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e3f7ec] text-brand dark:bg-brand-subtle" aria-hidden>
          <PlugZap className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">À brancher</p>
          <h3 id="sheet-unconfigured-title" className="mt-0.5 text-lg font-bold tracking-tight text-foreground">
            La Google Sheet n&apos;est pas encore reliée
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">Aucun chiffre n&apos;est affiché tant que la lecture n&apos;est pas branchée.</p>
        </div>
      </div>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-foreground marker:font-semibold marker:text-muted-foreground">
        <li>Créer un compte de service Google Cloud et activer l&apos;API Google Sheets.</li>
        <li>Partager la Sheet TutelLiv_Suivi_Prospection_2026 en <strong>lecteur</strong> avec l&apos;e-mail du compte de service.</li>
        <li>
          Poser sur Vercel (Preview, branche preproduction) :{" "}
          {missing.map((name, index) => (
            <span key={name}>
              <code className="break-all rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">{name}</code>
              {index < missing.length - 1 ? ", " : ""}
            </span>
          ))}
          , et si besoin <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">PROSPECTION_SHEET_HEADER_ROW</code> (ligne des en-têtes, {headerRow} par défaut).
        </li>
        <li>Redéployer, puis revenir sur cette page.</li>
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        Pas à pas détaillé : <span className="break-all font-mono">{SHEET_DOC}</span>.
      </p>
    </HomeCard>
  );
}

function Unavailable({ view }: { view: Extract<ProspectionSheetView, { status: "unavailable" }> }) {
  return (
    <HomeCard aria-labelledby="sheet-unavailable-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fbefeb] text-[#8a3b2a] dark:bg-secondary dark:text-error" aria-hidden>
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a3b2a] dark:text-error">Indisponible</p>
          <h3 id="sheet-unavailable-title" className="mt-0.5 text-lg font-bold tracking-tight text-foreground">Lecture de la Sheet impossible</h3>
          <p className="mt-1 break-words text-sm text-foreground">{view.cause}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Essai à {formatParisTime(view.checkedAt)} (heure de Paris), nouvel essai dans une minute au plus. Aucun chiffre n&apos;est affiché.
          </p>
        </div>
      </div>
      {view.ignoredTabs && view.ignoredTabs.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
          {view.ignoredTabs.map((tab) => (
            <li key={tab.title} className="break-words">
              Onglet « {tab.title} » : il manque {tab.missing.join(" et ")}.
            </li>
          ))}
        </ul>
      )}
    </HomeCard>
  );
}

function ReviewTile({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-secondary/70 px-3 py-3 dark:bg-secondary">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">{value === null ? "—" : formatCount(value)}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

const DECISION_TONE: Record<Decision["status"], { label: string; className: string }> = {
  act: { label: "Seuil atteint", className: "bg-[#fff1d6] text-[#7a4b00] dark:bg-secondary dark:text-warning" },
  ok: { label: "Pas atteint", className: "bg-[#e3f7ec] text-[#08783f] dark:bg-brand-subtle dark:text-brand" },
  pending: { label: "Trop tôt", className: "bg-muted text-foreground dark:bg-secondary" },
  unknown: { label: "Non calculable", className: "bg-muted text-muted-foreground dark:bg-secondary" },
};

function Decisions({ decisions }: { decisions: Decision[] }) {
  return (
    <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
      {decisions.map((decision) => {
        const tone = DECISION_TONE[decision.status];
        return (
          <li key={decision.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{decision.observation}</p>
              <p className="text-sm text-muted-foreground">→ {decision.decision}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{decision.detail}</p>
            </div>
            <span className={cn("inline-flex shrink-0 items-center self-start rounded-full px-2.5 py-1 text-xs font-semibold", tone.className)}>
              {tone.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Bars({ items, others, total, label }: { items: CountItem[]; others: number; total: number; label: string }) {
  if (items.length === 0) return <p className="mt-3 text-sm text-muted-foreground">Rien à afficher.</p>;
  return (
    <ul className="mt-3 space-y-2" aria-label={label}>
      {items.map((item) => (
        <li key={item.label} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-foreground" title={item.label}>{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-foreground">{formatCount(item.count)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
            <div className="h-full rounded-full bg-brand" style={{ width: `${total > 0 ? Math.max(2, (item.count / total) * 100) : 0}%` }} />
          </div>
        </li>
      ))}
      {others > 0 && <li className="text-xs text-muted-foreground">et {formatCount(others)} autre{others > 1 ? "s" : ""}</li>}
    </ul>
  );
}

function ReminderList({ title, icon: Icon, items, total, today, empty }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Reminder[];
  total: number;
  today: string;
  empty: string;
}) {
  return (
    <div className="min-w-0">
      <h4 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        {title}
        <span className="font-semibold tabular-nums text-muted-foreground">{formatCount(total)}</span>
      </h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-2xl border border-border">
          {items.map((reminder, index) => (
            <li key={`${reminder.tab}-${reminder.company}-${index}`} className="px-4 py-2.5">
              <p className="break-words text-sm font-semibold text-foreground">{reminder.company}</p>
              <p className="text-xs text-muted-foreground">
                {[reminder.city, reminder.owner ?? "Non attribué"].filter(Boolean).join(" · ")}
                {" · "}
                {formatDay(reminder.date)}
                {reminder.date < today ? ` (${lateLabel(reminder.date, today)})` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      {total > items.length && (
        <p className="mt-1 text-xs text-muted-foreground">Les {formatCount(items.length)} plus anciens sur {formatCount(total)} : le reste est dans la Sheet.</p>
      )}
    </div>
  );
}

function Ready({ view }: { view: ReadyView }) {
  const { review, reminders } = view;
  const stages = view.byStage.filter((stage) => stage.count > 0);
  const warnings = view.tabs.filter((tab) => tab.missingOptional.length > 0);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{formatCount(view.total)}</span> entreprise{view.total > 1 ? "s" : ""} dans{" "}
        {formatCount(view.tabs.length)} onglet{view.tabs.length > 1 ? "s" : ""} · lu à {formatParisTime(view.readAt)}, relu toutes les 5 minutes
      </p>

      <HomeCard aria-labelledby="sheet-review-title">
        <SectionTitle
          id="sheet-review-title"
          title="Revue du vendredi"
          hint="Une ligne par entreprise : l'étape actuelle compte aussi pour les précédentes (une démo faite a eu un entretien)."
        />
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <ReviewTile
            label="Contactées"
            value={review.contacted}
            hint={review.contactedThisWeek === null ? undefined : `dont ${formatCount(review.contactedThisWeek)} cette semaine`}
          />
          <ReviewTile label="En discussion" value={review.conversations} hint="ou plus loin" />
          <ReviewTile label="Entretiens" value={review.interviews} hint="faits" />
          <ReviewTile label="Démos" value={review.demos} hint="faites" />
          <ReviewTile label="Intéressées" value={review.interested} hint="dont pilote signé" />
          <ReviewTile label="Ne plus contacter" value={review.doNotContact} />
        </dl>
        <Decisions decisions={view.decisions} />
      </HomeCard>

      <HomeCard aria-labelledby="sheet-reminders-title">
        <SectionTitle id="sheet-reminders-title" title="Rappels" hint="Jour de Paris. Perdu et Ne plus contacter ne sont jamais relancés." />
        {reminders.available ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ReminderList title="Aujourd'hui" icon={BellRing} items={reminders.today} total={reminders.todayTotal} today={view.today} empty="Aucun rappel aujourd'hui." />
            <ReminderList title="En retard" icon={CalendarClock} items={reminders.overdue} total={reminders.overdueTotal} today={view.today} empty="Aucun rappel en retard." />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Aucun onglet n&apos;a de colonne « Date de rappel », « Rappel » ou « Relance ».</p>
        )}
        {reminders.unreadableDates > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {formatCount(reminders.unreadableDates)} date{reminders.unreadableDates > 1 ? "s" : ""} de rappel illisible{reminders.unreadableDates > 1 ? "s" : ""} (attendu : jj/mm/aaaa).
          </p>
        )}
      </HomeCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <HomeCard aria-labelledby="sheet-stages-title">
          <SectionTitle id="sheet-stages-title" title="Par étape" />
          <Bars items={stages.map((stage) => ({ label: stage.label, count: stage.count }))} others={0} total={view.total} label="Entreprises par étape" />
          {view.otherStagesTotal > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-sm font-semibold text-foreground">Autre <span className="tabular-nums text-muted-foreground">{formatCount(view.otherStagesTotal)}</span></p>
              <p className="text-xs text-muted-foreground">Statuts qui ne sont pas des étapes du plan de démarchage :</p>
              <Bars items={view.otherStages} others={view.otherStagesTotal - view.otherStages.reduce((sum, item) => sum + item.count, 0)} total={view.total} label="Autres statuts" />
            </div>
          )}
        </HomeCard>
        <HomeCard aria-labelledby="sheet-cities-title">
          <SectionTitle id="sheet-cities-title" title="Par ville" />
          <Bars items={view.byCity} others={view.byCityOthers} total={view.total} label="Entreprises par ville" />
        </HomeCard>
        <HomeCard aria-labelledby="sheet-owners-title">
          <SectionTitle id="sheet-owners-title" title="Par commercial" />
          {view.byOwner.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Aucune colonne « Commercial » dans la Sheet.</p>
          ) : (
            <Bars items={view.byOwner} others={view.byOwnerOthers} total={view.total} label="Entreprises par commercial" />
          )}
        </HomeCard>
      </div>

      {(warnings.length > 0 || view.ignoredTabs.length > 0) && (
        <HomeCard aria-labelledby="sheet-warnings-title">
          <SectionTitle id="sheet-warnings-title" title="En-têtes" hint={`Lus sur la ligne ${view.headerRow} de chaque onglet.`} />
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {warnings.map((tab) => (
              <li key={tab.title} className="break-words">
                Onglet « {tab.title} » : en-tête{tab.missingOptional.length > 1 ? "s" : ""} absent{tab.missingOptional.length > 1 ? "s" : ""} : {tab.missingOptional.join(", ")}
                {tab.cityFromTab ? " (le nom de l'onglet sert de ville)" : ""}.
              </li>
            ))}
            {view.ignoredTabs.map((tab) => (
              <li key={`ignored-${tab.title}`} className="break-words">
                Onglet « {tab.title} » ignoré : il manque {tab.missing.join(" et ")}.
              </li>
            ))}
          </ul>
        </HomeCard>
      )}
    </div>
  );
}

/** ADMIN-ESPACE lot 5 : chiffres de la Google Sheet de prospection (lecture seule, agrégats et rappels). */
export function ProspectionSheetPanel() {
  const { data, isLoading, error } = useAdminProspectionSheet();

  const header = (
    <div>
      <h2 id="sheet-title" className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
        <FileSpreadsheet className="h-5 w-5 text-brand" aria-hidden />
        Fichier de prospection
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Google Sheet TutelLiv_Suivi_Prospection_2026, lue en direct et en lecture seule. Les commerciaux continuent de travailler dans la Sheet.
      </p>
    </div>
  );

  let body: React.ReactNode;
  if (isInitialQueryLoading(isLoading, data)) {
    body = <div className={cn(HOME_CARD_CLASS, "h-64 animate-pulse")} aria-busy="true" aria-label="Lecture de la Sheet" />;
  } else if (error || !data) {
    body = (
      <Unavailable view={{ status: "unavailable", cause: "Le serveur n'a pas répondu.", checkedAt: new Date().toISOString() }} />
    );
  } else if (data.status === "unconfigured") {
    body = <Unconfigured missing={data.missing} headerRow={data.headerRow} />;
  } else if (data.status === "unavailable") {
    body = <Unavailable view={data} />;
  } else {
    body = <Ready view={data} />;
  }

  return (
    <section aria-labelledby="sheet-title" className="space-y-4">
      {header}
      {body}
    </section>
  );
}
