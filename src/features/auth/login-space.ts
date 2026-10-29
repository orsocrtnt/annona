/**
 * Connexion C « Trois espaces » : le choix de l'espace n'est qu'une aide visuelle. Le serveur décide toujours
 * de la destination (rôle relu en base, AUTH-ROLE) ; un mauvais choix n'ouvre ni ne ferme aucun accès.
 */
export type LoginContext = "company" | "client" | "driver";
export type LoginSpaceKey = "entreprise" | "client" | "chauffeur";

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
  chauffeur: {
    context: "driver",
    href: "/login/driver",
    title: "Chauffeur",
    description: "Missions du jour et navigation.",
  },
};

export const LOGIN_SPACE_KEYS = Object.keys(LOGIN_SPACES) as LoginSpaceKey[];

/** Repère « Dernier utilisé » : seulement la clé d'espace, jamais d'adresse ni d'identifiant. */
export const LAST_SPACE_STORAGE_KEY = "tutelliv-last-space";

export function isLoginSpaceKey(value: unknown): value is LoginSpaceKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LOGIN_SPACES, value);
}

type SearchValue = string | string[] | undefined;

function first(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export type LoginView = { kind: "choose" } | { kind: "form"; context: LoginContext; prefillDemo: boolean };

/**
 * Vue de `/login` d'après l'URL. `?espace=` valide ouvre le formulaire de cet espace ; toute autre valeur
 * revient au choix. Les liens existants (`?email=` de la démo, `?redirect=` du middleware et de l'inscription)
 * ouvrent directement le formulaire entreprise, comme avant.
 */
export function resolveLoginView(params: Record<string, SearchValue>): LoginView {
  const space = first(params.espace);
  const prefillDemo = first(params.demo) === "1";
  if (isLoginSpaceKey(space)) {
    const context = LOGIN_SPACES[space].context;
    return { kind: "form", context, prefillDemo: prefillDemo && context === "company" };
  }
  if (first(params.email) || first(params.redirect)) return { kind: "form", context: "company", prefillDemo: false };
  return { kind: "choose" };
}

/** Espace réellement ouvert par le serveur (et non celui choisi) : c'est lui qu'on retient. */
export function spaceForDestination(path: string): LoginSpaceKey {
  if (path === "/portal" || path.startsWith("/portal/")) return "client";
  if (path === "/driver" || path.startsWith("/driver/")) return "chauffeur";
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
