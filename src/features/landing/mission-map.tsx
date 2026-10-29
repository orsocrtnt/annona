import { FULFILLMENT_STATUS_LABELS } from "@/lib/constants/order-status";
import { TOUR_LANES, TOUR_ORDER } from "@/features/landing/product-tour/tour-data";
import styles from "@/features/landing/home-landing.module.css";

const DRIVER = TOUR_LANES[0];
const ROUTE = "M210 560 C 250 480, 300 450, 330 360 S 380 230, 430 150";

const card =
  "absolute rounded-2xl border border-border bg-card px-3.5 py-3 text-[13px] text-card-foreground shadow-[0_12px_32px_rgba(14,19,16,0.12)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.4)] max-sm:px-3 max-sm:py-2.5 max-sm:text-xs";

/**
 * Plan stylisé de la livraison fictive #1042 de la mini-démo (mêmes données que DEMO-3) : aucun fond de carte
 * réseau, aucune position réelle, aucune heure d'arrivée calculée (le produit affiche un créneau).
 */
export function MissionMap() {
  return (
    <figure
      className={styles.map}
      aria-label={`Illustration, données fictives : ${DRIVER.driver} livre la commande ${TOUR_ORDER.number} de ${TOUR_ORDER.pickup} au ${TOUR_ORDER.dropoff}, créneau ${TOUR_ORDER.slot}.`}
    >
      <svg className={styles.mapArt} viewBox="0 0 600 620" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
        <rect width="600" height="620" fill="var(--map-bg)" />
        <path d="M40 120h170v90H40zM420 60h140v120H420zM60 430h120v130H60z" fill="var(--map-park)" />
        <path d="M-20 300 C 120 250, 220 360, 330 330 S 520 250, 640 300" stroke="var(--map-water)" strokeWidth="34" fill="none" />
        <g stroke="var(--map-minor)" strokeWidth="7" fill="none">
          <path d="M0 80h600M0 190h600M0 410h600M0 520h600M110 0v620M250 0v620M380 0v620M500 0v620" />
        </g>
        <g stroke="var(--map-street)" strokeWidth="14" fill="none" strokeLinecap="round">
          <path d="M-10 40 L 610 260" />
          <path d="M60 640 L 330 -20" />
          <path d="M300 640 C 320 460, 420 380, 610 360" />
          <path d="M-10 470 C 160 470, 260 420, 330 360" />
        </g>
        <path className={styles.route} d={ROUTE} stroke="var(--route-casing)" strokeWidth="12" fill="none" strokeLinecap="round" />
        <path className={styles.route} d={ROUTE} stroke="var(--color-primary)" strokeWidth="6" fill="none" strokeLinecap="round" />
        <circle cx="210" cy="560" r="10" fill="var(--color-card)" stroke="var(--route-casing)" strokeWidth="4" />
        <circle cx="430" cy="150" r="12" fill="var(--route-casing)" />
        <circle cx="430" cy="150" r="5" fill="var(--color-primary)" />
        <circle cx="330" cy="360" r="16" fill="var(--color-primary)" stroke="var(--color-card)" strokeWidth="5" />
      </svg>

      <div className={`${card} left-[6%] top-[6%] max-w-[58%]`} aria-hidden>
        <b className="block text-sm font-semibold">
          {TOUR_ORDER.number} · {TOUR_ORDER.client}
        </b>
        <span className="text-xs text-muted-foreground">Créneau {TOUR_ORDER.slot}</span>
        <br />
        <span className="mt-1.5 inline-flex min-h-[22px] items-center rounded-full bg-brand-subtle px-2.5 text-[11.5px] font-semibold text-brand">
          {FULFILLMENT_STATUS_LABELS.IN_DELIVERY}
        </span>
      </div>
      <div className={`${card} right-[5%] top-[30%]`} aria-hidden>
        <b className="block text-sm font-semibold">{DRIVER.driver}</b>
        <span className="text-xs text-muted-foreground">{DRIVER.area}</span>
      </div>
      <div className={`${card} bottom-[118px] left-[6%]`} aria-hidden>
        <span className="block text-xs text-muted-foreground">Retrait</span>
        <b className="block text-sm font-semibold">{TOUR_ORDER.pickup}</b>
      </div>
      <div
        className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-[18px] bg-[#0e1310] px-4 py-3.5 text-[#f5f8f6] dark:border dark:border-border dark:bg-secondary dark:text-foreground"
        aria-hidden
      >
        <div className="min-w-0">
          <b className="block text-base font-semibold">Créneau {TOUR_ORDER.slot}</b>
          <span className="block truncate text-[13px] opacity-75">{TOUR_ORDER.dropoff}</span>
        </div>
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {DRIVER.driver.charAt(0)}
        </span>
      </div>
    </figure>
  );
}
