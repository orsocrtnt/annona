"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { MapContainer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useViewportHeight } from "@/hooks/use-viewport-height";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui.store";
import { MAP_TILES } from "@/lib/maps/provider-config";
import { MapAttribution } from "@/components/maps/provider-tile-layer";
import { BaseMapLayer } from "@/components/maps/vector-base-layer";
import type { LeafletBaseMapProps } from "./leaflet-base-map";
import { PARIS_CENTER } from "./leaflet-base-map";

function getMapHost(el: HTMLElement | null) {
  return el?.closest<HTMLElement>("[data-map-main]") ?? el?.parentElement;
}

function measureMapHost(host: HTMLElement) {
  const styles = window.getComputedStyle(host);
  const paddingLeft = parseFloat(styles.paddingLeft) || 0;
  const paddingRight = parseFloat(styles.paddingRight) || 0;
  const paddingTop = parseFloat(styles.paddingTop) || 0;
  const paddingBottom = parseFloat(styles.paddingBottom) || 0;

  return {
    width: Math.max(0, host.clientWidth - paddingLeft - paddingRight),
    height: Math.max(0, host.clientHeight - paddingTop - paddingBottom),
    offsetLeft: paddingLeft,
    offsetTop: paddingTop,
  };
}

function MapResizeHandler({ shellRef }: { shellRef: RefObject<HTMLDivElement | null> }) {
  const map = useMap();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  const refresh = useCallback(() => {
    map.invalidateSize({ animate: false });
  }, [map]);

  useEffect(() => {
    refresh();

    const observe = (el: Element | null | undefined) => {
      if (!el || typeof ResizeObserver === "undefined") return null;
      const resizeObserver = new ResizeObserver(() => {
        refresh();
        window.requestAnimationFrame(refresh);
      });
      resizeObserver.observe(el);
      return resizeObserver;
    };

    const host = getMapHost(shellRef.current);
    const observers = [
      observe(host),
      observe(shellRef.current),
    ].filter(Boolean) as ResizeObserver[];

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName === "left" || event.propertyName === "padding-left") refresh();
    };

    host?.addEventListener("transitionend", onTransitionEnd);
    window.addEventListener("resize", refresh);

    return () => {
      observers.forEach((o) => o.disconnect());
      host?.removeEventListener("transitionend", onTransitionEnd);
      window.removeEventListener("resize", refresh);
    };
  }, [refresh, shellRef]);

  useEffect(() => {
    refresh();
    const timers = [50, 150, 320].map((ms) => window.setTimeout(refresh, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [refresh, sidebarCollapsed]);

  return null;
}

export function LeafletBaseMapInner({
  height = 600,
  fill = false,
  navigation = false,
  variant = "uber",
  center = PARIS_CENTER,
  zoom = 12,
  children,
  className,
}: LeafletBaseMapProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [baseMode, setBaseMode] = useState<"vector" | "raster">("raster");
  const viewportHeight = useViewportHeight();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const [fillSize, setFillSize] = useState({
    width: 0,
    height: viewportHeight,
    offsetLeft: 0,
    offsetTop: 0,
  });

  useEffect(() => {
    if (!fill) return;

    const measure = () => {
      const host = getMapHost(shellRef.current);
      if (!host) {
        setFillSize({
          width: window.innerWidth,
          height: viewportHeight,
          offsetLeft: 0,
          offsetTop: 0,
        });
        return;
      }

      const measured = measureMapHost(host);
      setFillSize({
        width: measured.width > 0 ? measured.width : window.innerWidth,
        height: measured.height > 0 ? measured.height : viewportHeight,
        offsetLeft: measured.offsetLeft,
        offsetTop: measured.offsetTop,
      });
    };

    measure();
    const raf = window.requestAnimationFrame(measure);

    const host = getMapHost(shellRef.current);
    const resizeObserver =
      host && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;

    if (host) resizeObserver?.observe(host);
    window.addEventListener("resize", measure);

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName === "left" || event.propertyName === "padding-left") measure();
    };
    host?.addEventListener("transitionend", onTransitionEnd);

    const timers = [50, 150, 320].map((ms) => window.setTimeout(measure, ms));

    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
      host?.removeEventListener("transitionend", onTransitionEnd);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [fill, viewportHeight, sidebarCollapsed]);

  const shellStyle = fill
    ? {
        position: "absolute" as const,
        top: fillSize.offsetTop,
        left: fillSize.offsetLeft,
        width: fillSize.width > 0 ? fillSize.width : "100%",
        height: fillSize.height > 0 ? fillSize.height : viewportHeight,
        zIndex: 0,
      }
    : { height, width: "100%", position: "relative" as const, zIndex: 0 };

  return (
    <div
      ref={shellRef}
      className={cn(
        "leaflet-map-host",
        variant === "uber" && "leaflet-map-host--uber",
        baseMode === "vector" && "leaflet-map-host--vector",
        className
      )}
      data-map-variant={variant}
      style={shellStyle}
    >
      <MapContainer
        center={center}
        zoom={Math.min(zoom, MAP_TILES.maxZoom)}
        minZoom={MAP_TILES.minZoom}
        maxZoom={MAP_TILES.maxZoom}
        scrollWheelZoom
        zoomSnap={0.25}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <BaseMapLayer onModeChange={setBaseMode} />
        <MapResizeHandler shellRef={shellRef} />
        {children}
      </MapContainer>
      <MapAttribution navigation={navigation} fill={fill} vector={baseMode === "vector"} />
    </div>
  );
}
