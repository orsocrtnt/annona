"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarClock,
  CheckCircle2,
  MapPin,
  MousePointerClick,
  Plus,
  Receipt,
  Truck,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CityStreets } from "@/features/landing/product-tour/city-map";
import type { SceneProps } from "@/features/landing/product-tour/product-tour";
import { TOUR_INVOICE, TOUR_ORDER } from "@/features/landing/product-tour/tour-data";
import { clientNav } from "@/features/landing/product-tour/space-nav";
import { SpaceSidebar } from "@/features/landing/product-tour/space-sidebar";
import { GuideSpot } from "@/features/landing/product-tour/guide-bubble";
import { useTypewriter } from "@/features/landing/product-tour/typing";
import {
  GESTURE_RESULT_DELAY_MS,
  useDelayedCall,
  useTimeline,
} from "@/features/landing/product-tour/use-timeline";

const INTRO_DURATIONS_MS = [700] as const;
/** Le formulaire s'ouvre une fois la fenêtre agrandie. */
const ENLARGE_MS = 700;


const NAV = clientNav("Tableau de bord");

const FIELDS = [
  { icon: Warehouse, label: "Retrait", placeholder: "Adresse de retrait", value: TOUR_ORDER.pickup },
  { icon: MapPin, label: "Livraison", placeholder: "Adresse de livraison", value: TOUR_ORDER.dropoff },
  { icon: CalendarClock, label: "Créneau", placeholder: "Choisir un créneau", value: `Aujourd'hui · ${TOUR_ORDER.slot}` },
] as const;

const FIELD_TEXTS = FIELDS.map((field) => field.value);

const HOME_DELIVERIES = [
  { number: "#1038", place: "Bureau Bastille", status: "En route", x: 256, y: 168, live: true },
  { number: "#1040", place: "Studio Oberkampf", status: "Livrée", x: 176, y: 96, live: false },
] as const;

const HOME_ACTIVITY = [
  { text: "#1038 prise en charge par Lucas", when: "Aujourd'hui · 11 h 05" },
  { text: "#1040 livrée, preuve photo jointe", when: "Hier · 16 h 42" },
  { text: "Facture F-2026-1031 payée", when: "Hier · 09 h 10" },
] as const;

/** Tableau de bord du client (démo) : ce qu'il suit d'un coup d'œil avant de commander. */
const HOME_KPIS = [
  { label: "En cours", value: "1", icon: Truck, tone: "bg-[#eaf2ff] text-[#1d4f9e]" },
  { label: "Livrées ce mois", value: "14", icon: CheckCircle2, tone: "bg-[#e6f8ee] text-[#00a854]" },
  { label: "Prochain créneau", value: TOUR_ORDER.slot, icon: CalendarClock, tone: "bg-[#f0f4f1] text-[#0e1310]" },
  { label: "À régler", value: TOUR_INVOICE.amount, icon: Receipt, tone: "bg-[#fff1d6] text-[#a8660b]" },
] as const;

/** Les livraisons en cours du client sur le même plan que le suivi. */
function HomeMap() {
  return (
    <svg viewBox="50 30 340 230" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Carte de vos livraisons en cours" className="h-full w-full">
      <CityStreets />
      {HOME_DELIVERIES.map((delivery) => (
        <g key={delivery.number} transform={`translate(${delivery.x} ${delivery.y})`}>
          {delivery.live && <circle r="15" fill="#00d46a" fillOpacity="0.18" className="product-tour-halo" />}
          <circle r="7" fill={delivery.live ? "#00d46a" : "#0e1310"} stroke="#ffffff" strokeWidth="2.5" />
          <g transform="translate(12 -22)">
            <rect width="62" height="18" rx="9" fill="#ffffff" stroke="#0e1310" strokeOpacity="0.08" />
            <text x="31" y="12.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="#0e1310">
              {delivery.number}
            </text>
          </g>
        </g>
      ))}
    </svg>
  );
}

function OrderPanel({
  onOrdered,
  onCancel,
  ordered,
  reducedMotion,
}: {
  onOrdered: () => void;
  onCancel: () => void;
  ordered: boolean;
  reducedMotion: boolean;
}) {
  const { typed, activeField, done } = useTypewriter(FIELD_TEXTS, true, reducedMotion);

  return (
    <div className="flex h-full flex-col px-4 py-4 sm:px-6 sm:py-5">
      <p className="text-base font-bold tracking-[-0.02em] sm:text-lg">Nouvelle commande</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Livraison standard · colis de 4 kg</p>

      <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-2.5">
        {FIELDS.map(({ icon: Icon, label, placeholder }, index) => {
          const isActive = index === activeField;
          const text = typed[index] ?? "";
          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-white px-3 py-2 transition-[border-color,box-shadow] duration-300 motion-reduce:transition-none sm:py-2.5",
                isActive ? "border-[#00d46a] shadow-[0_0_0_3px_rgba(0,212,106,0.15)]" : "border-black/[0.08]"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[#00a854]" : "text-muted-foreground")} strokeWidth={1.75} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                <p className="flex min-h-5 items-center truncate text-sm font-medium">
                  {text ? <span className="truncate">{text}</span> : !isActive && <span className="text-muted-foreground/60">{placeholder}</span>}
                  {isActive && <span className="product-tour-caret ml-px inline-block h-4 w-[1.5px] shrink-0 bg-[#0e1310]" aria-hidden />}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <GuideSpot
        id="order-form"
        corner="br"
        className="bottom-28 right-6"
        lines={[ordered ? "Reçue au dispatch, en direct." : "Pas d'appel, pas d'e-mail."]}
      />

      <div className="mt-auto pt-3">
        {ordered ? (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#e6f8ee] px-4 py-3 text-sm font-semibold text-[#0e1310]"
          >
            <CheckCircle2 className="h-4 w-4 text-[#00a854]" aria-hidden />
            Commande {TOUR_ORDER.number} envoyée
          </motion.p>
        ) : (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-[#f0f4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Annuler
              </button>
              <button
                type="button"
                data-tour-target
                disabled={!done}
                onClick={onOrdered}
                className={cn(
                  "flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
                  done ? "product-tour-pulse" : "opacity-40"
                )}
              >
                Créer la commande
              </button>
            </div>
            <p
              className={cn(
                "mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground transition-opacity duration-300 motion-reduce:transition-none",
                done ? "opacity-100" : "opacity-0"
              )}
              aria-hidden={!done}
            >
              <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
              Cliquez sur « Créer la commande »
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** ① Espace client : l'accueil, puis « Nouvelle commande » ouvre le formulaire qui se tape tout seul. */
export function SceneClientOrder({ onDone, onStart, onReset, reducedMotion }: SceneProps) {
  const intro = useTimeline(INTRO_DURATIONS_MS, reducedMotion);
  const [starting, setStarting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [ordered, setOrdered] = useState(false);
  useDelayedCall(starting, reducedMotion ? 0 : ENLARGE_MS, () => setFormOpen(true));
  const ready = intro >= INTRO_DURATIONS_MS.length;
  // Laisse lire « Reçue au dispatch, en direct. » avant de passer au dispatch.
  useDelayedCall(ordered, GESTURE_RESULT_DELAY_MS + 2600, onDone);

  return (
    <div className="flex h-full">
      <SpaceSidebar items={NAV} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">Bonjour, {TOUR_ORDER.client}</p>
            <p className="truncate text-[11px] text-muted-foreground">Votre espace client</p>
          </div>
          <div className="relative flex shrink-0 flex-col items-end">
            <button
              type="button"
              data-tour-target
              disabled={!ready || starting}
              onClick={() => {
                setStarting(true);
                onStart();
              }}
              className={cn(
                "flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
                ready && !starting ? "product-tour-pulse" : !ready && "opacity-40"
              )}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              Nouvelle commande
            </button>
          </div>
        </div>

        <div className="@container flex min-h-0 flex-1 flex-col gap-2.5 px-3 pb-3 sm:px-4 sm:pb-4">
          <ul className="grid grid-cols-2 gap-2 @lg:grid-cols-4" aria-label="Vos livraisons en chiffres">
            {HOME_KPIS.map(({ label, value, icon: Icon, tone }) => (
              <li key={label} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 ring-1 ring-black/[0.05]">
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", tone)} aria-hidden>
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-bold tracking-[-0.02em]">{value}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{label}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 @lg:grid-cols-[1.25fr_1fr]">
            <div className="relative min-h-[120px] overflow-hidden rounded-2xl ring-1 ring-black/[0.05]">
              <HomeMap />
              {ready && !starting && (
                <GuideSpot id="order-home" corner="bl" className="bottom-3 left-3" lines={["Vos clients commandent seuls."]} />
              )}
              <p className="absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold">Suivi en direct</p>
            </div>

            <div className="flex min-h-0 flex-col gap-2.5">
              <div className="rounded-2xl bg-white p-2.5 ring-1 ring-black/[0.05]">
                <p className="px-1 text-xs font-semibold">Mes livraisons</p>
                <ul className="mt-1.5 space-y-1">
                  {HOME_DELIVERIES.map((delivery) => (
                    <li key={delivery.number} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 text-xs">
                      <span className="min-w-0 truncate">
                        <span className="font-semibold">{delivery.number}</span>
                        <span className="text-muted-foreground"> · {delivery.place}</span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          delivery.live ? "bg-[#e6f8ee] text-[#0e1310]" : "bg-[#f0f4f1] text-muted-foreground"
                        )}
                      >
                        {delivery.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="hidden items-center gap-2 rounded-2xl bg-white p-2.5 ring-1 ring-black/[0.05] @lg:flex">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f0f4f1]" aria-hidden>
                  <Receipt className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-xs font-semibold">Dernière facture</p>
                  <p className="truncate text-[10px] text-muted-foreground">F-2026-1031 · 52,00 €</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#e6f8ee] px-2 py-0.5 text-[10px] font-semibold">Payée</span>
              </div>
              <div className="hidden min-h-0 flex-1 overflow-hidden rounded-2xl bg-white p-2.5 ring-1 ring-black/[0.05] @lg:block">
                <p className="px-1 text-xs font-semibold">Activité récente</p>
                <ol className="mt-2 space-y-2.5 border-l border-[#e4e8e5] pl-3">
                  {HOME_ACTIVITY.map((event) => (
                    <li key={event.text} className="relative text-[11px] leading-tight">
                      <span className="absolute -left-[16.5px] top-1 h-2 w-2 rounded-full bg-[#00d46a] ring-2 ring-white" aria-hidden />
                      <p className="font-medium">{event.text}</p>
                      <p className="text-[10px] text-muted-foreground">{event.when}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {formOpen && (
            <>
              <motion.div
                key="backdrop"
                className="absolute inset-0 bg-[#0e1310]/15"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                aria-hidden
              />
              <motion.div
                key="panel"
                role="dialog"
                aria-label="Nouvelle commande"
                className="absolute inset-y-0 right-0 w-full bg-white shadow-[-20px_0_50px_rgba(14,19,16,0.12)] sm:w-[88%] sm:rounded-l-2xl"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 30 }}
              >
                <OrderPanel ordered={ordered} reducedMotion={reducedMotion} onOrdered={() => setOrdered(true)} onCancel={onReset} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
