import { z } from "zod";

/**
 * SEC-AUDIT : Zod 4 teste `new Function("")` au premier parse pour choisir son mode rapide. Sous la CSP
 * (sans `'unsafe-eval'`), ce test produit une violation sur chaque page. Le mode sans eval évite le test ;
 * il est importé par `AppProviders`, avant tout parse côté navigateur.
 */
z.config({ jitless: true });
