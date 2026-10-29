"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TileLayer } from "react-leaflet";
import { MAP_TILES, MAP_VECTOR, TILE_TIMEOUT_MS } from "@/lib/maps/provider-config";

/** Markers stay usable when the background fails; retry only on user action. */
export function ProviderTileLayer() {
  const [attempt, setAttempt] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const failed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <>
    <TileLayer key={attempt} url={MAP_TILES.url} minZoom={MAP_TILES.minZoom}
      maxZoom={MAP_TILES.maxZoom} maxNativeZoom={MAP_TILES.maxZoom}
      eventHandlers={{
        loading: () => {
          failed.current = false;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => { failed.current = true; setUnavailable(true); }, TILE_TIMEOUT_MS);
        },
        tileerror: () => { failed.current = true; setUnavailable(true); },
        load: () => { clearTimeout(timer.current); if (!failed.current) setUnavailable(false); },
      }} />
    {unavailable && <div role="status" className="absolute inset-x-3 top-1/2 z-[1200] mx-auto max-w-sm rounded-xl border border-black/10 bg-white/95 p-3 text-center text-sm text-foreground shadow-lg dark:border-white/10 dark:bg-card/95">
      <p>Fond de carte indisponible. Les positions restent affichées.</p>
      <button type="button" className="mt-2 min-h-11 rounded-lg bg-black px-4 font-medium text-white outline-none transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary-hover dark:focus-visible:ring-ring dark:focus-visible:ring-offset-card" onClick={() => { failed.current = false; setUnavailable(false); setAttempt(a => a + 1); }}>Réessayer la carte</button>
    </div>}
  </>;
}

/**
 * Mentions des sources (obligatoires : OpenStreetMap, fond, géocodage, itinéraires), repliées en un
 * petit bouton « i » pour ne pas couvrir la carte ; un clic les ouvre, Échap ou un second clic les ferme.
 */
export function MapAttribution({ navigation = false, fill = false, vector = false }: { navigation?: boolean; fill?: boolean; vector?: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return <div className="absolute right-3.5 z-[1200] flex max-w-[95%] items-center justify-end gap-3"
    style={{ bottom: navigation ? "min(40%, 19rem)" : fill ? "min(28%, 11rem)" : 14 }}
    onKeyDown={(event) => { if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); } }}>
    {open && <div id={panelId} className="rounded-md border border-black/5 bg-white/95 px-1.5 py-0.5 text-right text-[9px] leading-tight text-zinc-600 shadow-sm dark:border-white/10 dark:bg-card/95 dark:text-muted-foreground [&_a]:underline"
      dangerouslySetInnerHTML={{ __html: `${vector ? MAP_VECTOR.attribution : MAP_TILES.attribution}<br/>Géocodage : <a href="https://adresse.data.gouv.fr/">BAN</a> / <a href="https://cartes.gouv.fr/">IGN</a> · Itinéraires : <a href="https://project-osrm.org/">OSRM</a> / <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://www.openstreetmap.org/fixthemap">Corriger la carte</a>` }} />}
    <button type="button" aria-label={open ? "Masquer les sources de la carte" : "Sources de la carte"} aria-expanded={open} aria-controls={panelId}
      onClick={() => setOpen((value) => !value)}
      className="group -m-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full outline-none">
      <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-white/90 text-[11px] font-semibold italic text-zinc-600 transition-colors group-hover:text-zinc-900 group-focus-visible:ring-2 group-focus-visible:ring-ring dark:border-white/10 dark:bg-card/90 dark:text-muted-foreground dark:group-hover:text-foreground">i</span>
    </button>
  </div>;
}
