/**
 * CLI-05 et lot 1 (D1, matin et soir le même jour) : que faire du panier quand la commande existante
 * pour la date et le créneau choisis est connue.
 * - « load » : la commande existante remplit un panier vide, un panier issu d'une autre commande enregistrée,
 *   ou un panier quand la commande n'est plus modifiable ;
 * - « conflict » : le panier contient autre chose, le client choisit ;
 * - « clear » : le panier venait d'une autre commande déjà enregistrée (ex. celle du matin) et ce créneau
 *   n'a pas de commande : il repart vide, sinon la commande du soir reprendrait les articles du matin ;
 * - « keep » : rien à changer (panier en cours jamais enregistré, ou commande déjà chargée).
 */
export type CartSyncAction = "load" | "conflict" | "clear" | "keep";

export function cartSyncAction(input: {
  existing: { id: string; editable: boolean } | null;
  loadedOrderId: string | null;
  hasQuantities: boolean;
}): CartSyncAction {
  const { existing, loadedOrderId, hasQuantities } = input;
  if (existing) {
    if (loadedOrderId === existing.id) return "keep";
    // Un panier issu d'une autre commande enregistrée n'est pas un brouillon : il est remplacé.
    return !hasQuantities || !existing.editable || loadedOrderId ? "load" : "conflict";
  }
  return loadedOrderId ? "clear" : "keep";
}
