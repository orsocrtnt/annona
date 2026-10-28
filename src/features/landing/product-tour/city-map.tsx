import { TOUR_ROUTE, pointAlongRoute } from "@/features/landing/product-tour/city-route";

type CityMapProps = {
  /** Fraction du trajet déjà parcourue (0 → entrepôt, 1 → adresse de livraison). */
  progress: number;
  showRoute: boolean;
  variant: "driver" | "client";
};

/** Les rues dépassent le cadre 400 × 300 : le cadrage « meet » peut montrer leurs abords. */
const STREETS = [
  "M-400 62 H800",
  "M-400 140 H800",
  "M-400 214 H800",
  "M-400 268 H800",
  "M16 -300 V600",
  "M96 -300 V600",
  "M176 -300 V600",
  "M256 -300 V600",
  "M336 -300 V600",
  "M416 -300 V600",
  "M-100 -100 L120 140",
  "M256 140 L520 -40",
] as const;

/** Suivi : tout le trajet ; navigation : zoom sur le livreur. */
const CLIENT_VIEWBOX = "146 30 220 262";
const DRIVER_VIEWBOX_SIZE = { width: 170, height: 230 } as const;

const PARKS = [
  { x: 20, y: 76, width: 60, height: 50 },
  { x: 272, y: 76, width: 48, height: 48 },
  { x: 108, y: 228, width: 52, height: 28 },
] as const;

const routePath = TOUR_ROUTE.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");

/** Plan de ville dessiné, aux couleurs Menthe : aucune tuile réseau. */
export function CityMap({ progress, showRoute, variant }: CityMapProps) {
  const position = pointAlongRoute(TOUR_ROUTE, progress);
  const ahead = pointAlongRoute(TOUR_ROUTE, Math.min(progress + 0.02, 1));
  const behind = pointAlongRoute(TOUR_ROUTE, Math.max(progress - 0.02, 0));
  const heading = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI + 90;
  const start = TOUR_ROUTE[0] ?? position;
  const end = TOUR_ROUTE[TOUR_ROUTE.length - 1] ?? position;
  const viewBox =
    variant === "client"
      ? CLIENT_VIEWBOX
      : `${position.x - DRIVER_VIEWBOX_SIZE.width / 2} ${position.y - DRIVER_VIEWBOX_SIZE.height * 0.7} ${DRIVER_VIEWBOX_SIZE.width} ${DRIVER_VIEWBOX_SIZE.height}`;

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={
        variant === "driver"
          ? "Navigation du livreur : trajet de l'entrepôt d'Ivry à la rue de la Roquette"
          : "Carte du suivi : le livreur avance vers l'adresse de livraison"
      }
      className="h-full w-full bg-[#eef4f0]"
    >
      <rect x="-400" y="-300" width="1200" height="900" fill="#eef4f0" />
      {PARKS.map((park) => (
        <rect key={`${park.x}-${park.y}`} {...park} rx="8" fill="#d6efdf" />
      ))}
      <path d="M-400 176 H0 C 110 160, 210 236, 400 200 H800" fill="none" stroke="#cfe3f1" strokeWidth="18" strokeLinecap="round" />
      {STREETS.map((street) => (
        <path key={street} d={street} fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />
      ))}

      {showRoute && (
        <>
          <path d={routePath} fill="none" stroke="#00d46a" strokeOpacity="0.25" strokeWidth="11" strokeLinejoin="round" strokeLinecap="round" />
          <path d={routePath} fill="none" stroke="#00b85c" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}

      <rect x={start.x - 9} y={start.y - 9} width="18" height="18" rx="5" fill="#0e1310" />
      <path d={`M${start.x - 4} ${start.y + 3} V${start.y - 1} L${start.x} ${start.y - 4} L${start.x + 4} ${start.y - 1} V${start.y + 3} Z`} fill="#ffffff" />
      <g transform={`translate(${end.x} ${end.y})`}>
        <path d="M0 0 C -9 -10, -11 -15, -11 -20 A 11 11 0 1 1 11 -20 C 11 -15, 9 -10, 0 0 Z" fill="#00d46a" stroke="#0e1310" strokeWidth="1.5" />
        <circle cx="0" cy="-20" r="4" fill="#0e1310" />
      </g>

      {variant === "driver" ? (
        <g transform={`translate(${position.x} ${position.y}) rotate(${heading})`}>
          <circle r="15" fill="#00d46a" fillOpacity="0.2" />
          <circle r="10" fill="#ffffff" stroke="#0e1310" strokeWidth="1.5" />
          <path d="M0 -6 L5 5 L0 2.5 L-5 5 Z" fill="#0e1310" />
        </g>
      ) : (
        <g transform={`translate(${position.x} ${position.y})`}>
          <circle r="16" fill="#00d46a" fillOpacity="0.18" className="product-tour-halo" />
          <circle r="8" fill="#00d46a" stroke="#ffffff" strokeWidth="3" />
        </g>
      )}
    </svg>
  );
}
