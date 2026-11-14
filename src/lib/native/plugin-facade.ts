/**
 * MOBILE-1 — façade d'un module natif Capacitor, sûre à renvoyer depuis une fonction asynchrone.
 *
 * Un module Capacitor est un Proxy : toute propriété inconnue devient un appel natif. Quand une fonction
 * `async` le renvoie, la promesse vérifie s'il a une méthode `then` ; Capacitor répond par une erreur
 * (« "Geolocation.then()" is not implemented on android ») et la fonction échoue. Constat du 14 novembre 2026
 * dans l'application Android : le suivi de position du livreur ne démarrait jamais. On renvoie donc un objet
 * ordinaire qui ne transmet que les méthodes utilisées.
 */
export function pluginFacade<T extends object>(plugin: T, methods: ReadonlyArray<keyof T & string>): T {
  const facade: Record<string, unknown> = {};
  for (const name of methods) {
    facade[name] = (...args: unknown[]) => (plugin[name] as unknown as (...values: unknown[]) => unknown).apply(plugin, args);
  }
  return facade as T;
}
