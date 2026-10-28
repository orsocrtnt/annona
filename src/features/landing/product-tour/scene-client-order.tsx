"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarClock,
  CheckCircle2,
  Home,
  LifeBuoy,
  MapPin,
  MapPinned,
  MousePointerClick,
  Package,
  Plus,
  Receipt,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CityStreets } from "@/features/landing/product-tour/city-map";
import type { SceneProps } from "@/features/landing/product-tour/product-tour";
import { TOUR_ORDER } from "@/features/landing/product-tour/tour-data";
import { useTypewriter } from "@/features/landing/product-tour/typing";
import {
  GESTURE_RESULT_DELAY_MS,
  useDelayedCall,
  useTimeline,
} from "@/features/landing/product-tour/use-timeline";

const INTRO_DURATIONS_MS = [900] as const;

const NAV = [
  { icon: Home, label: "Accueil", active: true },
  { icon: Package, label: "Commandes" },
  { icon: MapPinned, label: "Suivi" },
  { icon: Receipt, label: "Factures" },
  { icon: LifeBuoy, label: "Support" },
] as const;

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

/** Les livraisons en cours du client sur le même plan que le suivi. */
function HomeMap() {
  return (
    <svg viewBox="70 40 300 210" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Carte de vos livraisons en cours" className="h-full w-full">
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

function Sidebar() {
  return (
    <aside className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-black/[0.06] bg-white py-3 sm:w-[136px] sm:items-stretch sm:px-2.5">
      <div className="mb-3 flex items-center gap-2 sm:px-1.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00d46a] text-xs font-black text-[#0e1310]" aria-hidden>
          T
        </span>
        <span className="hidden text-sm font-bold tracking-[-0.02em] sm:inline">TutelLiv</span>
      </div>
      {NAV.map(({ icon: Icon, label, ...item }) => (
        <span
          key={label}
          className={cn(
            "flex h-8 w-8 items-center justify-center gap-2 rounded-lg text-xs font-medium sm:h-auto sm:w-auto sm:justify-start sm:px-2 sm:py-1.5",
            "active" in item ? "bg-[#e6f8ee] text-[#0e1310]" : "text-muted-foreground"
          )}
          aria-current={"active" in item ? "page" : undefined}
        >
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          <span className="hidden sm:inline">{label}</span>
        </span>
      ))}
    </aside>
  );
}

function OrderPanel({ onOrdered, ordered, reducedMotion }: { onOrdered: () => void; ordered: boolean; reducedMotion: boolean }) {
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
            <button
              type="button"
              disabled={!done}
              onClick={onOrdered}
              className={cn(
                "flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
                done ? "product-tour-pulse" : "opacity-40"
              )}
            >
              Commander
            </button>
            <p
              className={cn(
                "mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground transition-opacity duration-300 motion-reduce:transition-none",
                done ? "opacity-100" : "opacity-0"
              )}
              aria-hidden={!done}
            >
              <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
              Cliquez pour commander
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** ① Espace client : l'accueil, puis « Nouvelle commande » ouvre le formulaire qui se tape tout seul. */
export function SceneClientOrder({ onDone, reducedMotion }: SceneProps) {
  const intro = useTimeline(INTRO_DURATIONS_MS, reducedMotion);
  const [formOpen, setFormOpen] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const ready = intro >= INTRO_DURATIONS_MS.length;
  useDelayedCall(ordered, GESTURE_RESULT_DELAY_MS, onDone);

  return (
    <div className="flex h-full">
      <Sidebar />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <div className="min-w-0 leading-tight">
            <p className="text-[11px] text-muted-foreground">Bonjour</p>
            <p className="truncate text-sm font-semibold">{TOUR_ORDER.client}</p>
          </div>
          <div className="relative flex flex-col items-end">
            <button
              type="button"
              disabled={!ready || formOpen}
              onClick={() => setFormOpen(true)}
              className={cn(
                "flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
                ready && !formOpen ? "product-tour-pulse" : !ready && "opacity-40"
              )}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              Nouvelle commande
            </button>
          </div>
        </div>

        <div className="relative mx-3 min-h-0 flex-1 overflow-hidden rounded-2xl ring-1 ring-black/[0.05] sm:mx-4">
          <HomeMap />
          <p
            className={cn(
              "absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-[#0e1310] px-2 py-1 text-[11px] font-semibold text-white shadow-lg transition-opacity duration-300 motion-reduce:transition-none",
              ready && !formOpen ? "opacity-100" : "opacity-0"
            )}
            aria-hidden={!ready || formOpen}
          >
            <MousePointerClick className="h-3 w-3" aria-hidden />
            Cliquez sur « Nouvelle commande »
          </p>
        </div>

        <div className="mx-3 my-3 rounded-2xl bg-white p-2.5 ring-1 ring-black/[0.05] sm:mx-4">
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
                <OrderPanel ordered={ordered} reducedMotion={reducedMotion} onOrdered={() => setOrdered(true)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
