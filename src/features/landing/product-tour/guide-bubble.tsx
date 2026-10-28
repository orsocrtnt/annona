"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { cn } from "@/lib/utils";
import {
  guideOnTarget,
  guideOpen,
  guideTravel,
  spotPoint,
  type GuideCorner,
  type GuideLine,
  type GuidePlace,
  type GuideState,
} from "@/features/landing/product-tour/guide-spot";

/**
 * Emplacement de la bulle-guide : un repère invisible où elle vient se poser. Sans ligne, elle y reste en goutte ;
 * avec une action, la bulle ouverte devient un bouton.
 */
export function GuideSpot({
  id,
  lines,
  corner = "tl",
  action,
  slow = false,
  className,
}: {
  id: string;
  lines: readonly (string | GuideLine)[];
  corner?: GuideCorner;
  action?: string;
  slow?: boolean;
  className?: string;
}) {
  return (
    <span
      data-guide-spot={id}
      data-guide-action={action}
      data-guide-slow={slow ? "true" : undefined}
      data-guide-corner={corner}
      data-guide-lines={JSON.stringify(lines.map((line) => (typeof line === "string" ? { text: line } : line)))}
      className={cn("pointer-events-none absolute", className)}
      aria-hidden
    />
  );
}

/** Intervalle de recherche de l'emplacement : les scènes le posent au fil de leurs animations. */
const LOOKUP_MS = 200;
/** La bulle se rétracte en goutte, la goutte glisse, puis s'ouvre en bulle. */
/** Le temps que la bulle redevienne une goutte bien ronde, avant de partir. */
const COLLAPSE_MS = 560;
const TRAVEL_MS = 620;
const SLOW_TRAVEL = { type: "tween", ease: [0.65, 0, 0.35, 1], duration: 1.3 } as const;
/** Goutte déjà posée sur son emplacement : un court temps avant de s'ouvrir. */
const ARRIVED_OPEN_MS = 400;
/** Délai d'une ligne après l'ouverture, en plus de son propre délai. */
const LINE_DELAY_MS = 150;
/** Au-delà, l'emplacement donne sa largeur à la bulle (colonne d'explications). */
const SPOT_MIN_WIDTH = 40;
const DROP_SIZE = 18;
const INK = "#2b3530";
const MINT = "#00d46a";
/**
 * Trajet « humain » : la goutte démarre doucement, accélère, puis freine avant d'arriver.
 * La forme, elle, rebondit un peu comme un liquide.
 */
const TRAVEL_SPRING = { type: "tween", ease: [0.65, 0, 0.35, 1], duration: 0.62 } as const;
const MORPH_SPRING = { type: "spring", bounce: 0.22, visualDuration: 0.45 } as const;

/** Ouverte, la bulle part exactement du coin indiqué ; en goutte, elle se décale pour être centrée sur le point. */
const BODY_POSITION: Record<GuideCorner, string> = {
  tl: "left-0 top-0",
  tr: "right-0 top-0",
  bl: "left-0 bottom-0",
  br: "right-0 bottom-0",
  c: "left-0 top-0",
};

function dropOffset(corner: GuideCorner) {
  const half = DROP_SIZE / 2;
  return { x: corner.endsWith("r") ? half : -half, y: corner.startsWith("b") ? half : -half };
}

/** Le dernier emplacement du DOM l'emporte : l'écran d'accueil passe devant la scène qu'il recouvre. */
function readSpot(stage: HTMLElement): GuidePlace | null {
  const spots = stage.querySelectorAll<HTMLElement>("[data-guide-spot]");
  const element = spots[spots.length - 1];
  if (!element) return null;
  const corner = (element.dataset.guideCorner ?? "tl") as GuideCorner;
  const box = element.getBoundingClientRect();
  return {
    id: element.dataset.guideSpot ?? "",
    corner,
    ...spotPoint(box, stage.getBoundingClientRect(), corner),
    width: Math.round(box.width),
    lines: JSON.parse(element.dataset.guideLines ?? "[]") as GuideLine[],
    action: element.dataset.guideAction,
    slow: element.dataset.guideSlow === "true",
  };
}

/** Lignes affichées une à une, chacune après son délai ; toutes retirées quand la bulle se rétracte. */
function useRevealedLines(lines: readonly GuideLine[], open: boolean, reducedMotion: boolean): GuideLine[] {
  const [revealed, setRevealed] = useState<string[]>([]);
  const key = JSON.stringify(lines);

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => setRevealed([]), 0);
      return () => clearTimeout(timer);
    }
    const timers = (JSON.parse(key) as GuideLine[]).map((line) =>
      setTimeout(
        () => setRevealed((current) => (current.includes(line.text) ? current : [...current, line.text])),
        reducedMotion ? 0 : LINE_DELAY_MS + (line.delay ?? 0) * 1000
      )
    );
    return () => timers.forEach(clearTimeout);
  }, [key, open, reducedMotion]);

  return lines.filter((line) => revealed.includes(line.text));
}

/**
 * Bulle-guide unique de la démo, toujours visible : un seul élément qui se rétracte en goutte,
 * glisse jusqu'au prochain emplacement en s'étirant dans le sens du trajet, puis s'ouvre à la taille de son texte.
 */
export function GuideBubble({
  stage,
  reducedMotion,
  collapsed = false,
  actions = {},
}: {
  stage: RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
  /** Fin d'étape : la bulle se remet en boule sur place, quel que soit l'emplacement. */
  collapsed?: boolean;
  actions?: Record<string, () => void>;
}) {
  const [target, setTarget] = useState<GuidePlace | null>(null);
  const [guide, setGuide] = useState<GuideState>({ mode: "drop", place: null, heading: 0, trip: 0 });
  const latestGuide = useRef(guide);
  useEffect(() => {
    latestGuide.current = guide;
  }, [guide]);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const [stretch, animateStretch] = useAnimate<HTMLDivElement>();
  const open = guide.mode === "open";
  const lines = useRevealedLines(guide.place?.lines ?? [], open, reducedMotion);
  const placed = guide.place !== null;

  useEffect(() => {
    // Un emplacement qui bouge encore (panneau qui glisse, fenêtre qui s'agrandit) n'est pris
    // qu'une fois immobile : la goutte ne part jamais vers un point de passage.
    let last: GuidePlace | null = null;
    const timer = setInterval(() => {
      const next = stage.current ? readSpot(stage.current) : null;
      const moving = next !== null && last !== null && (Math.abs(next.x - last.x) > 1 || Math.abs(next.y - last.y) > 1);
      const fresh = next !== null && (last === null || last.id !== next.id);
      last = next;
      if (moving || fresh) return;
      setTarget((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
    }, LOOKUP_MS);
    return () => clearInterval(timer);
  }, [stage]);

  // Étape validée : dès le clic sur le geste attendu, la bulle redevient une goutte et attend sur place.
  // Elle ne se rouvre que pour un nouveau message (autre emplacement ou autre texte).
  const latestTarget = useRef<GuidePlace | null>(null);
  const heldTarget = useRef<string | null>(null);
  useEffect(() => {
    latestTarget.current = target;
  }, [target]);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-tour-target]")) return;
      heldTarget.current = JSON.stringify(latestTarget.current);
      // Après le clic, pour que le bouton cliqué reçoive d'abord son geste.
      setTimeout(() => setGuide((current) => (current.mode === "open" ? { ...current, mode: "drop" } : current)), 0);
    };
    element.addEventListener("click", onClick, true);
    return () => element.removeEventListener("click", onClick, true);
  }, [stage]);

  // Fin de la rétractation en cours : la goutte ne part jamais avant d'être redevenue ronde.
  const collapseEnd = useRef(0);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) collapseEnd.current = performance.now() + COLLAPSE_MS;
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (collapsed) {
      timers.push(setTimeout(() => setGuide((current) => (current.mode === "open" ? { ...current, mode: "drop" } : current)), 0));
      return () => timers.forEach(clearTimeout);
    }
    if (target && heldTarget.current === JSON.stringify(target)) return;
    heldTarget.current = null;
    const wait = Math.max(0, collapseEnd.current - performance.now());
    const at = (delayMs: number, update: (guide: GuideState) => GuideState) =>
      timers.push(setTimeout(() => setGuide(update), reducedMotion ? 0 : wait + delayMs));
    at(0, (current) => guideOnTarget(current, target));
    if (target) {
      // Délais selon l'état réel : ouverte ailleurs = se rétracter, voler, s'ouvrir ; déjà en goutte = voler
      // puis s'ouvrir ; déjà arrivée = s'ouvrir presque tout de suite.
      const now = latestGuide.current;
      const arrived = now.mode === "drop" && now.place?.id === target.id;
      const collapse = now.mode === "open" && now.place?.id !== target.id ? COLLAPSE_MS : 0;
      const openAt = arrived ? ARRIVED_OPEN_MS : collapse + TRAVEL_MS;
      if (collapse) at(collapse, (current) => (current.mode === "open" ? current : guideTravel(current, target)));
      at(openAt, (current) =>
        current.mode === "open" && current.place?.id === target.id ? { ...current, place: target } : guideOpen(current, target)
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [target, reducedMotion, collapsed]);

  // Étirement de la goutte dans le sens du trajet, à chaque nouveau départ, puis retour à l'horizontale.
  useEffect(() => {
    if (guide.trip === 0 || reducedMotion || !stretch.current) return;
    const element = stretch.current;
    animateStretch(element, { rotate: guide.heading }, { duration: 0 });
    const flight = animateStretch(
      element,
      { scaleX: [1, 1.75, 0.88, 1], scaleY: [1, 0.72, 1.1, 1] },
      // Étirée au plus fort de la vitesse, à mi-trajet, puis tassée au freinage.
      { duration: TRAVEL_MS / 1000, times: [0, 0.5, 0.88, 1], ease: "easeInOut" }
    );
    flight.then(() => animateStretch(element, { rotate: 0 }, { duration: 0 }));
    return () => flight.stop();
  }, [guide.trip, guide.heading, reducedMotion, animateStretch, stretch]);

  // Une bulle ouverte n'est jamais penchée ni étirée, même si un trajet a été interrompu.
  useEffect(() => {
    if (open && stretch.current) animateStretch(stretch.current, { rotate: 0, scaleX: 1, scaleY: 1 }, { duration: 0 });
  }, [open, animateStretch, stretch]);

  useLayoutEffect(() => {
    const element = content.current;
    if (!placed || !element) return;
    const measure = () => setSize({ width: element.offsetWidth, height: element.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [placed]);

  const place = guide.place;
  if (!place) return null;
  const width = place.width > SPOT_MIN_WIDTH ? place.width : undefined;
  const expanded = open && size !== null;
  const action = expanded && place.action ? actions[place.action] : undefined;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-50 hidden sm:block"
      data-guide-mode={guide.mode}
      data-guide-place={place.id}
      data-guide-target={target?.id ?? ""}
    >
      <motion.div
        className="absolute left-0 top-0"
        initial={false}
        animate={{ x: place.x, y: place.y }}
        transition={reducedMotion ? { duration: 0 } : place.slow ? SLOW_TRAVEL : TRAVEL_SPRING}
      >
        <div ref={stretch} className="absolute left-0 top-0">
          {/* Bulle-bouton : elle bat comme un cœur autour de son point d'ancrage. */}
          <div className={cn("absolute left-0 top-0")}>
          <motion.div
            initial={false}
            animate={
              expanded
                ? {
                    width: size.width,
                    height: size.height,
                    borderRadius: place.action ? 24 : 18,
                    backgroundColor: INK,
                    x: place.corner === "c" ? -size.width / 2 : 0,
                    y: place.corner === "c" ? -size.height / 2 : 0,
                  }
                : { width: DROP_SIZE, height: DROP_SIZE, borderRadius: DROP_SIZE / 2, backgroundColor: MINT, ...dropOffset(place.corner) }
            }
            transition={reducedMotion ? { duration: 0 } : { ...MORPH_SPRING, backgroundColor: { duration: 0.3 } }}
            className={cn("product-tour-guide absolute", BODY_POSITION[place.corner])}
          >
            <motion.span
              className="product-tour-drop absolute inset-0 rounded-[inherit]"
              initial={false}
              animate={{ opacity: expanded ? 0 : 1 }}
              transition={{ duration: 0.25 }}
              aria-hidden
            />
            {expanded && (
              <span
                key={`${guide.trip}-${action ? "loop" : "once"}`}
                className={cn(action ? "product-tour-guide-glow-loop" : "product-tour-guide-glow", "absolute inset-0 rounded-[inherit]")}
                aria-hidden
              />
            )}
            <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
              {/* Matière : reflet du haut, lueur menthe dans le coin, puis un éclat de lumière qui traverse la bulle. */}
              <motion.span
                className="product-tour-guide-sheen absolute inset-0"
                initial={false}
                animate={{ opacity: expanded ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                aria-hidden
              />
              {expanded && (
                <span
                  key={`shine-${guide.trip}-${action ? "loop" : "once"}`}
                  className={cn(action ? "product-tour-guide-shine-loop" : "product-tour-guide-shine", "absolute inset-0")}
                  aria-hidden
                />
              )}
              <div
                ref={content}
                style={{ width }}
                className={cn(
                  "absolute font-semibold leading-snug text-white",
                  place.action ? "px-6 py-4 text-lg tracking-[-0.01em]" : "px-3.5 py-2.5 text-[13px]",
                  place.corner.endsWith("r") ? "right-0" : "left-0",
                  place.corner.startsWith("b") ? "bottom-0" : "top-0",
                  !width && (place.action ? "w-max whitespace-nowrap" : "w-max max-w-[250px]")
                )}
              >
                <AnimatePresence initial={true}>
                  {lines.map((line, index) => (
                    <motion.p
                      key={line.text}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ type: "spring", bounce: 0, visualDuration: 0.3, delay: 0.12 }}
                      className={cn(index > 0 && "mt-1.5 border-t border-white/10 pt-1.5")}
                    >
                      {line.text}
                    </motion.p>
                  ))}
                </AnimatePresence>
              </div>
            </div>
            {action && (
              <button
                type="button"
                data-tour-target
                onClick={action}
                aria-label={lines.map((line) => line.text).join(" ")}
                className="pointer-events-auto absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2b3530]"
              />
            )}
          </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
