/**
 * Connexion : l'espace demandé n'est qu'une aide visuelle. Le serveur décide toujours
 * de la destination (rôle relu en base, AUTH-ROLE) ; un mauvais choix n'ouvre ni ne ferme aucun accès.
 */
export type LoginContext = "company" | "client" | "driver";
export type LoginSpaceKey = "entreprise" | "client" | "livreur";

export const LOGIN_SPACES: Record<
  LoginSpaceKey,
  { context: LoginContext; href: string; title: string; description: string }
> = {
  entreprise: {
    context: "company",
    href: "/login?espace=entreprise",
    title: "Entreprise",
    description: "Commandes, dispatch, flotte et facturation.",
  },
  client: {
    context: "client",
    href: "/login/client",
    title: "Client",
    description: "Commander, suivre ses livraisons, retrouver ses factures.",
  },
  livreur: {
    context: "driver",
    href: "/login/driver",
    title: "Livreur",
    description: "Missions du jour et navigation.",
  },
};

export const LOGIN_SPACE_KEYS = Object.keys(LOGIN_SPACES) as LoginSpaceKey[];

/** Repère « Dernier utilisé » : seulement la clé d'espace, jamais d'adresse ni d'identifiant. */
export const LAST_SPACE_STORAGE_KEY = "annona-last-space";

export function isLoginSpaceKey(value: unknown): value is LoginSpaceKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LOGIN_SPACES, value);
}

type SearchValue = string | string[] | undefined;

function first(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export type LoginView = { kind: "form"; context: LoginContext; prefillDemo: boolean };

/**
 * Vue de `/login` d'après l'URL. Plus d'écran de choix (5 novembre 2026) : `/login` ouvre tout de suite le
 * formulaire commun et le serveur envoie chacun dans son espace d'après son rôle. `?espace=` valide ne change
 * que l'en-tête (anciens liens) ; toute autre valeur ouvre le formulaire commun, sans erreur.
 */
export function resolveLoginView(params: Record<string, SearchValue>): LoginView {
  const space = first(params.espace);
  const prefillDemo = first(params.demo) === "1";
  const context = isLoginSpaceKey(space) ? LOGIN_SPACES[space].context : "company";
  return { kind: "form", context, prefillDemo: prefillDemo && context === "company" };
}

/** Espace réellement ouvert par le serveur (et non celui choisi) : c'est lui qu'on retient. */
export function spaceForDestination(path: string): LoginSpaceKey {
  if (path === "/portal" || path.startsWith("/portal/")) return "client";
  if (path === "/driver" || path.startsWith("/driver/")) return "livreur";
  return "entreprise";
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

/** `window.localStorage` peut lever une exception (stockage bloqué, navigation privée) : null dans ce cas. */
export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readLastSpace(storage: KeyValueStorage | null | undefined): LoginSpaceKey | null {
  try {
    const value = storage?.getItem(LAST_SPACE_STORAGE_KEY);
    return isLoginSpaceKey(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberLastSpace(storage: KeyValueStorage | null | undefined, destination: string): void {
  try {
    storage?.setItem(LAST_SPACE_STORAGE_KEY, spaceForDestination(destination));
  } catch {
    /* stockage bloqué : simple repère visuel perdu */
  }
}
