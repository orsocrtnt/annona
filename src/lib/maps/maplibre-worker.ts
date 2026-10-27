import { getVersion, setWorkerUrl } from "maplibre-gl";
import { maplibreWorkerUrl } from "@/lib/maps/provider-config";

let configured = false;

/** À appeler avant la première carte : le chemin par défaut de MapLibre 6 est introuvable une fois empaqueté. */
export function configureMaplibreWorker() {
  if (configured) return;
  setWorkerUrl(maplibreWorkerUrl(getVersion()));
  configured = true;
}
