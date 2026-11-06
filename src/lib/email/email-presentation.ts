/** Présentation pure : uniquement des valeurs déjà présentes dans le message figé. */
export type EmailPresentation = {
  heading: string;
  badge: string;
  tone?: "warning" | "danger";
  details?: { label: string; value: string }[];
};

const DELIVERY: Record<string, { heading: string; status: string; tone?: "warning" | "danger" }> = {
  "Livreur assigné": { heading: "Un livreur pour votre livraison.", status: "Livreur assigné" },
  "Prise en charge": { heading: "Votre livraison est prise en charge.", status: "Prise en charge" },
  "Courses en cours": { heading: "Vos courses ont commencé.", status: "Courses en cours" },
  "En cours de livraison": { heading: "Votre livraison est en route.", status: "En cours de livraison" },
  "Livraison effectuée": { heading: "Votre livraison est arrivée.", status: "Livrée" },
  "Livraison annulée": { heading: "Votre livraison a été annulée.", status: "Annulée", tone: "warning" },
  "Livraison non effectuée": { heading: "Votre livraison n’a pas pu aboutir.", status: "Non effectuée", tone: "danger" },
};

export function emailPresentation(subject: string, text: string): EmailPresentation | undefined {
  if (Object.hasOwn(DELIVERY, subject)) {
    const copy = DELIVERY[subject]!;
    // Formulations des notifications de livraison ; aucune donnée de destinataire déduite.
    const reference = /(?:assigné à |pris en charge |courses de |^)([^\s]+)(?= ont commencé\.| est en route\.| a été livrée\.| a été annulée\.| n’a pas pu être livrée\.|\.$)/m.exec(text)?.[1];
    return { heading: copy.heading, badge: subject.toLocaleUpperCase("fr-FR"), tone: copy.tone,
      details: [...(reference ? [{ label: "Référence", value: reference }] : []), { label: "Statut", value: copy.status }] };
  }
  if (subject === "Bienvenue sur Annona") {
    const account = /Votre espace (.+) est prêt avec l’offre (\S+) \((mensuel|annuel)\)\./.exec(text);
    return { heading: "Tout est prêt. À vous de jouer.", badge: "BIENVENUE", details: account ? [
      { label: "Entreprise", value: account[1]! },
      { label: "Offre", value: account[2]! },
      { label: "Facturation", value: account[3] === "annuel" ? "Annuelle" : "Mensuelle" },
    ] : undefined };
  }
  const invoice = /^(Rappel : facture |Facture )(.+)$/.exec(subject);
  if (!invoice) return undefined;
  const reminder = invoice[1] === "Rappel : facture ";
  const amount = reminder
    ? /d'un montant de ([\d\s\u00a0\u202f.,]+€)/.exec(text)?.[1]
    : /\(([\d\s\u00a0\u202f.,]+€)\) est disponible\./.exec(text)?.[1];
  const due = reminder ? /, échue le ([^,\n]+), reste à régler/.exec(text)?.[1] : undefined;
  return {
    heading: reminder ? "Un rappel pour votre facture." : "Votre facture est disponible.",
    badge: reminder ? "RAPPEL DE PAIEMENT" : "FACTURATION",
    tone: reminder ? "warning" : undefined,
    details: [
      { label: "Référence", value: invoice[2]! },
      ...(amount ? [{ label: "Montant", value: amount.trim() }] : []),
      ...(due ? [{ label: "Échéance", value: due }] : []),
    ],
  };
}
