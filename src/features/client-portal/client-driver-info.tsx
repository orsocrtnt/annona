import { Phone, Truck } from "lucide-react";

/**
 * Livreur affecté vu par le client : prénom et téléphone (seulement si l'entreprise ne l'a pas masqué).
 * Composant unique pour la fiche livraison et la fiche commande, afin qu'elles affichent exactement la même chose.
 */
export function ClientDriverInfo({ driver }: { driver?: { firstName: string; phone?: string | null } | null }) {
  if (!driver) return null;
  return (
    <div className="space-y-1" data-testid="client-driver-info">
      <div className="flex items-center gap-3">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <span>Livreur : {driver.firstName}</span>
      </div>
      {driver.phone ? (
        <a href={`tel:${driver.phone}`} className="ml-7 flex items-center gap-1 text-sm text-brand hover:underline">
          <Phone className="h-3 w-3" /> {driver.phone}
        </a>
      ) : null}
    </div>
  );
}
