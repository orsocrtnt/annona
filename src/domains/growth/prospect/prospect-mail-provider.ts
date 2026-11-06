/**
 * ADMIN-ESPACE lot 5 : adresses « mises de côté » (décision du propriétaire du 5 novembre 2026).
 * Essais réels : le mail mis en forme arrive chez Gmail, Google Workspace et Columbia (Proofpoint), mais tombe
 * en indésirables chez Microsoft 365 (Kedge, ENPC) et n'arrive pas derrière Altospam (Lalique), tant que
 * tutelliv.fr n'a pas d'historique. Ces adresses sont ajoutées à la campagne sans être envoyées ; le propriétaire
 * les remet dans l'envoi d'un clic quand le domaine aura un historique.
 * Module sans dépendance serveur : partagé par le service (lecture DNS) et l'écran.
 */

export const PROSPECT_SET_ASIDE_PREFIX = "Mis de côté";

export type StrictMailProvider = "Microsoft" | "Altospam" | "Mailinblack";

/** Boîtes grand public de Microsoft (hotmail.fr, outlook.com, live.fr, msn.com…). */
const MICROSOFT_CONSUMER_DOMAIN = /^(hotmail|outlook|live|msn|windowslive|passport)\.[a-z.]+$/;

const STRICT_MX: Array<{ pattern: RegExp; provider: StrictMailProvider }> = [
  // Microsoft 365 (…mail.protection.outlook.com) et boîtes grand public (…olc.protection.outlook.com).
  { pattern: /\.protection\.outlook\.com$/, provider: "Microsoft" },
  { pattern: /(^|\.)arsmtp\.com$/, provider: "Altospam" },
  { pattern: /(^|\.)mailinblack\.com$/, provider: "Mailinblack" },
];

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

/** Fournisseur strict d'après le domaine et ses serveurs de messagerie (MX), sinon null. */
export function strictProviderFromMx(domain: string, mxHosts: readonly string[]): StrictMailProvider | null {
  if (MICROSOFT_CONSUMER_DOMAIN.test(domain.toLowerCase())) return "Microsoft";
  for (const host of mxHosts) {
    const name = host.toLowerCase().replace(/\.$/, "");
    const match = STRICT_MX.find((entry) => entry.pattern.test(name));
    if (match) return match.provider;
  }
  return null;
}

export function setAsideDetail(provider: StrictMailProvider): string {
  return `${PROSPECT_SET_ASIDE_PREFIX} : ${provider}`;
}

export function isSetAsideDetail(detail: string | null | undefined): boolean {
  return Boolean(detail?.startsWith(PROSPECT_SET_ASIDE_PREFIX));
}

export type MxLookup = (domain: string) => Promise<string[]>;

/**
 * Fournisseur strict de chaque adresse, un appel DNS par domaine. Une réponse lente ou en erreur ne bloque pas
 * l'adresse (elle reste envoyable) : seule une détection positive la met de côté.
 */
export async function findStrictProviders(
  emails: readonly string[],
  lookup: MxLookup,
  timeoutMs = 3_000
): Promise<Map<string, StrictMailProvider>> {
  const domains = [...new Set(emails.map(emailDomain))];
  const byDomain = new Map<string, StrictMailProvider | null>();
  await Promise.all(
    domains.map(async (domain) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<string[]>((resolve) => {
        timer = setTimeout(() => resolve([]), timeoutMs);
      });
      const hosts = await Promise.race([lookup(domain).catch(() => [] as string[]), timeout]);
      clearTimeout(timer);
      byDomain.set(domain, strictProviderFromMx(domain, hosts));
    })
  );
  const result = new Map<string, StrictMailProvider>();
  for (const email of emails) {
    const provider = byDomain.get(emailDomain(email));
    if (provider) result.set(email, provider);
  }
  return result;
}
