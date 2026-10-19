"use client";
import dynamic from "next/dynamic";
export type { MapMarker } from "./delivery-map-inner";
import type { DeliveryMapProps } from "./delivery-map-inner";
const Inner = dynamic(() => import("./delivery-map-inner").then(m => m.DeliveryMapInner), { ssr: false });
export function DeliveryMap(props: DeliveryMapProps) { return <Inner {...props} />; }
