import type { DispatchMapPoint } from "@/domains/delivery/dispatch-map.service";
import type { DispatchLeafletMarker } from "@/components/maps/dispatch-leaflet-map";
import { formatDriverFromParts } from "@/lib/format/person-labels";

export function toLeafletMarkers(points: DispatchMapPoint[]): DispatchLeafletMarker[] {
  return points.map((point) => ({
    id: point.id,
    latitude: point.latitude,
    longitude: point.longitude,
    kind: point.kind,
    label: point.label,
    popupHtml: [
      `<strong>${point.reference}</strong>`,
      point.label,
      point.address,
      point.driverName
        ? formatDriverFromParts(null, point.driverName)
        : "Non assignée",
    ]
      .filter(Boolean)
      .join("<br/>"),
  }));
}
