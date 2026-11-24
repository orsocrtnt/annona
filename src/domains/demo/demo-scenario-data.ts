/**
 * DEMO-1 — données fixes de la journée de démonstration : rues de Paris (coordonnées approchées), noms de clients
 * inventés, profils de commande par type de client. Aucune donnée réelle.
 */

export type DemoStreet = readonly [street: string, postalCode: string, latitude: number, longitude: number];

/** 40 rues au nord de la Seine : tournée Nord. */
export const DEMO_STREETS_NORTH: readonly DemoStreet[] = [
  ["rue des Abbesses", "75018", 48.8846, 2.3382],
  ["rue Lepic", "75018", 48.8857, 2.3345],
  ["rue Caulaincourt", "75018", 48.8879, 2.3352],
  ["rue Ordener", "75018", 48.892, 2.348],
  ["rue Marcadet", "75018", 48.8915, 2.344],
  ["boulevard de Clichy", "75018", 48.8833, 2.332],
  ["rue des Martyrs", "75009", 48.88, 2.3398],
  ["rue Frochot", "75009", 48.8818, 2.3375],
  ["rue de Clichy", "75009", 48.879, 2.329],
  ["rue du Faubourg-Montmartre", "75009", 48.874, 2.343],
  ["rue Cadet", "75009", 48.8758, 2.3433],
  ["rue La Fayette", "75009", 48.8752, 2.348],
  ["rue du Faubourg-Saint-Denis", "75010", 48.874, 2.356],
  ["quai de Valmy", "75010", 48.8723, 2.3641],
  ["rue de Paradis", "75010", 48.8757, 2.352],
  ["rue du Château-d'Eau", "75010", 48.871, 2.359],
  ["rue Oberkampf", "75011", 48.8656, 2.3788],
  ["rue Jean-Pierre-Timbaud", "75011", 48.867, 2.374],
  ["rue de Belleville", "75020", 48.8723, 2.3802],
  ["rue de Ménilmontant", "75020", 48.868, 2.388],
  ["rue des Pyrénées", "75020", 48.865, 2.399],
  ["avenue Secrétan", "75019", 48.88, 2.373],
  ["rue de Crimée", "75019", 48.886, 2.378],
  ["avenue Jean-Jaurès", "75019", 48.883, 2.374],
  ["rue Montorgueil", "75002", 48.8651, 2.3474],
  ["rue Réaumur", "75002", 48.867, 2.348],
  ["rue Saint-Denis", "75002", 48.866, 2.351],
  ["rue de Bretagne", "75003", 48.863, 2.362],
  ["rue de Turbigo", "75003", 48.865, 2.356],
  ["rue des Batignolles", "75017", 48.8846, 2.3197],
  ["avenue des Ternes", "75017", 48.8795, 2.2959],
  ["rue de Lévis", "75017", 48.883, 2.311],
  ["rue de Courcelles", "75017", 48.882, 2.303],
  ["avenue de Wagram", "75017", 48.879, 2.301],
  ["rue de Rome", "75008", 48.879, 2.323],
  ["rue du Faubourg-Saint-Honoré", "75008", 48.873, 2.31],
  ["rue de Rivoli", "75001", 48.86, 2.342],
  ["rue Saint-Honoré", "75001", 48.863, 2.339],
  ["avenue d'Eylau", "75016", 48.8651, 2.2874],
  ["rue de Passy", "75016", 48.8575, 2.279],
];

/** 40 rues au sud : tournée Sud. */
export const DEMO_STREETS_SOUTH: readonly DemoStreet[] = [
  ["rue du Four", "75006", 48.8531, 2.3314],
  ["rue de Buci", "75006", 48.8536, 2.3368],
  ["rue de Vaugirard", "75006", 48.847, 2.327],
  ["rue de Rennes", "75006", 48.848, 2.328],
  ["rue Mouffetard", "75005", 48.8419, 2.3498],
  ["rue Monge", "75005", 48.845, 2.352],
  ["boulevard Saint-Germain", "75005", 48.851, 2.35],
  ["rue Gay-Lussac", "75005", 48.844, 2.342],
  ["rue de la Butte-aux-Cailles", "75013", 48.828, 2.3502],
  ["place d'Italie", "75013", 48.8311, 2.3558],
  ["avenue des Gobelins", "75013", 48.835, 2.352],
  ["rue de Tolbiac", "75013", 48.826, 2.36],
  ["boulevard Diderot", "75012", 48.8462, 2.3738],
  ["rue de Charenton", "75012", 48.844, 2.385],
  ["avenue Daumesnil", "75012", 48.84, 2.39],
  ["cours de Vincennes", "75012", 48.848, 2.4],
  ["rue du Faubourg-Saint-Antoine", "75011", 48.8532, 2.3707],
  ["avenue Ledru-Rollin", "75011", 48.8531, 2.3766],
  ["rue de la Roquette", "75011", 48.8555, 2.376],
  ["boulevard Voltaire", "75011", 48.854, 2.389],
  ["rue Saint-Antoine", "75004", 48.854, 2.364],
  ["rue des Rosiers", "75004", 48.856, 2.359],
  ["rue Saint-Louis-en-l'Île", "75004", 48.8516, 2.356],
  ["rue Pernety", "75014", 48.8339, 2.3181],
  ["rue Daguerre", "75014", 48.834, 2.327],
  ["avenue du Général-Leclerc", "75014", 48.829, 2.327],
  ["rue d'Alésia", "75014", 48.828, 2.325],
  ["rue de la Convention", "75015", 48.8396, 2.2954],
  ["rue du Commerce", "75015", 48.846, 2.294],
  ["rue Lecourbe", "75015", 48.842, 2.301],
  ["rue Cambronne", "75015", 48.845, 2.303],
  ["rue Cler", "75007", 48.8561, 2.3061],
  ["rue de Grenelle", "75007", 48.856, 2.316],
  ["rue du Bac", "75007", 48.854, 2.326],
  ["avenue Bosquet", "75007", 48.856, 2.302],
  ["rue de Sèvres", "75007", 48.849, 2.32],
  ["rue Saint-Charles", "75015", 48.847, 2.287],
  ["boulevard de Port-Royal", "75005", 48.839, 2.34],
  ["rue de la Glacière", "75013", 48.832, 2.343],
  ["avenue de Choisy", "75013", 48.824, 2.362],
];

/**
 * Types de clients et catégories du catalogue qu'ils commandent, de la plus à la moins fournie
 * (identifiants de `DEMO_CATALOG`).
 */
export const DEMO_MERCHANT_TYPES: ReadonlyArray<{ label: string; categories: readonly string[] }> = [
  { label: "Café", categories: ["viennoiseries", "pains", "patisseries", "snacking"] },
  { label: "Bistrot", categories: ["pains", "pains-speciaux", "patisseries", "gateaux"] },
  { label: "Brasserie", categories: ["pains", "pains-speciaux", "gateaux", "patisseries"] },
  { label: "Hôtel", categories: ["viennoiseries", "pains", "pains-speciaux", "patisseries"] },
  { label: "Épicerie", categories: ["pains", "pains-speciaux", "snacking", "viennoiseries"] },
  { label: "Restaurant", categories: ["pains", "pains-speciaux", "patisseries", "gateaux"] },
  { label: "Supérette", categories: ["pains", "viennoiseries", "snacking", "pains-speciaux"] },
  { label: "Cantine", categories: ["sale", "pains", "patisseries", "snacking"] },
  { label: "Coffee shop", categories: ["viennoiseries", "patisseries", "snacking", "pains"] },
  { label: "Traiteur", categories: ["sale", "pains", "pains-speciaux", "gateaux"] },
];

/** 20 mots × 10 types : 200 noms de clients distincts. */
export const DEMO_MERCHANT_WORDS = [
  "Lumière",
  "Valmy",
  "des Arts",
  "du Marché",
  "Saint-Martin",
  "Bellevue",
  "du Canal",
  "des Lilas",
  "Montorgueil",
  "du Square",
  "des Halles",
  "Rivoli",
  "Opéra",
  "des Tilleuls",
  "du Port",
  "Gambetta",
  "des Vosges",
  "Jardin",
  "Parmentier",
  "Voltaire",
] as const;

/** Quantités habituelles par catégorie (minimum, maximum), par livraison. */
export const DEMO_QUANTITY_RANGES: Readonly<Record<string, readonly [number, number]>> = {
  pains: [10, 60],
  "pains-speciaux": [2, 12],
  viennoiseries: [10, 60],
  patisseries: [4, 16],
  gateaux: [1, 3],
  sale: [4, 20],
  snacking: [2, 10],
};

export const DEMO_FIRST_NAMES = [
  "Inès",
  "Hugo",
  "Nadia",
  "Paul",
  "Karim",
  "Claire",
  "Léa",
  "Julien",
  "Samir",
  "Margaux",
  "Thomas",
  "Élodie",
  "Antoine",
  "Yasmine",
  "Romain",
  "Sophie",
  "Louis",
  "Chloé",
  "Mehdi",
  "Anne",
] as const;

export const DEMO_LAST_NAMES = [
  "Martin",
  "Lefèvre",
  "Benali",
  "Girard",
  "Haddad",
  "Dubois",
  "Fontaine",
  "Roche",
  "Ouali",
  "Petit",
  "Bernard",
  "Moreau",
  "Garnier",
  "Diallo",
  "Lambert",
  "Laurent",
  "Mercier",
  "Henry",
  "Robin",
  "Faure",
  "Nguyen",
  "Rousseau",
  "Blanc",
] as const;

export const DEMO_ACCESS_INSTRUCTIONS = [
  "Rideau à moitié levé dès 6h, déposer derrière le comptoir.",
  "Livraison par la cour, digicode 4821B.",
  "Sonner à l'interphone « Livraison ».",
  "Entrée de service à gauche de la terrasse.",
  "Déposer devant la porte vitrée si fermé, sous la bâche.",
  "Livraison en cuisine, sonnette « Fournisseurs ».",
  "Ouverture 6h30, attendre le gérant.",
  "Quai de livraison au sous-sol, badge à la réception.",
  "Rue piétonne : se garer dans la rue voisine, 2 minutes à pied.",
  "Volet fermé avant 7h : déposer dans le sas.",
] as const;

// ---------------------------------------------------------------------------
// Lot 2 dans la démo : pâtisserie, boutiques, stock, gâteaux des particuliers (demande d'Orso du 24 novembre 2026).
// ---------------------------------------------------------------------------

/** Catégories du catalogue faites par le pâtissier (LOT2-D2) ; les autres sont du pain (boulanger). */
export const DEMO_PASTRY_CATEGORIES: ReadonlySet<string> = new Set(["patisseries", "gateaux"]);

/** Durée de vente en boutique par catégorie, jour de réception compris (LOT2-D3). */
export const DEMO_SHELF_LIFE_BY_CATEGORY: Readonly<Record<string, number>> = {
  pains: 1,
  "pains-speciaux": 2,
  viennoiseries: 1,
  patisseries: 2,
  gateaux: 2,
  sale: 1,
  snacking: 1,
};

/** Exceptions par produit : biscuits et cakes se gardent plus longtemps. */
export const DEMO_SHELF_LIFE_BY_PRODUCT: Readonly<Record<string, number>> = {
  "Macarons (boîte de 6)": 3,
  Financier: 3,
  "Madeleines (sachet de 10)": 4,
  "Cookie aux pépites": 3,
  "Cake au citron": 4,
  "Cake marbré": 4,
  "Pain de seigle 500 g": 3,
};

/** Recettes de quelques pâtisseries, lues seulement par le pâtissier et l'administrateur (LOT2-D3). */
export const DEMO_RECIPES: Readonly<Record<string, string>> = {
  "Éclair au chocolat":
    "Pâte à choux : 250 g d'eau, 250 g de lait, 220 g de beurre, 10 g de sel, 10 g de sucre, 300 g de farine, 500 g d'œufs. Dresser des bâtons de 14 cm, cuire 35 min à 165 °C. Crème pâtissière au chocolat noir 70 %, glaçage fondant chocolat.",
  "Tartelette citron meringuée":
    "Pâte sucrée foncée en cercles de 8 cm, cuite à blanc 18 min à 160 °C. Crème citron (jus, zestes, œufs, sucre, beurre monté à 40 °C). Meringue italienne pochée, colorée au chalumeau.",
  Millefeuille:
    "Feuilletage inversé 6 tours, abaissé à 2 mm, cuit entre deux plaques, caramélisé au sucre glace. Crème diplomate vanille. Montage en trois abaisses, glaçage fondant et marbrure chocolat.",
  "Paris-Brest individuel":
    "Couronnes de pâte à choux de 9 cm, amandes effilées, 35 min à 165 °C. Crème mousseline au praliné noisette 60 %, éclats de praliné au cœur.",
  Fraisier:
    "Génoise vanille en deux disques imbibés au sirop kirsch. Crème mousseline vanille, fraises gariguettes coupées en deux sur le pourtour. Pâte d'amande rose abaissée à 2 mm sur le dessus.",
  "Saint-Honoré":
    "Fond de pâte feuilletée, couronne et choux de pâte à choux, caramel à 165 °C. Crème chiboust vanille, chantilly mascarpone pochée à la douille Saint-Honoré.",
  "Royal chocolat":
    "Biscuit dacquoise amande, croustillant praliné feuillantine, mousse chocolat noir 64 %. Glaçage miroir cacao, à couler à 35 °C sur l'entremets congelé.",
  Framboisier:
    "Biscuit joconde imbibé, crème mousseline pistache, framboises fraîches en couronne. Nappage framboise et pâte d'amande verte.",
};

/**
 * Gros gâteaux sur commande (LOT2-D3 et D9) : vendus par taille, en nombre de parts. Prix restaurant HT par taille ;
 * le prix boutique (TTC) en est tiré par la démo.
 */
export const DEMO_LARGE_CAKES: ReadonlyArray<{ name: string; sizes: ReadonlyArray<readonly [servings: number, restaurantPriceCents: number]> }> = [
  { name: "Fraisier", sizes: [[6, 2400], [8, 3100], [10, 3800]] },
  { name: "Framboisier", sizes: [[6, 2400], [8, 3100], [10, 3800]] },
  { name: "Royal chocolat", sizes: [[6, 2300], [8, 2900], [12, 4200]] },
  { name: "Saint-Honoré", sizes: [[6, 2700], [8, 3500]] },
];

/** Catégorie des gros gâteaux, propre à la démo (le catalogue du seed n'en a pas). */
export const DEMO_LARGE_CAKE_CATEGORY = { id: "gros-gateaux", name: "Commandes sur mesure" } as const;

/**
 * Boutiques de l'entreprise (LOT2-D1) : un arrêt de la tournée du matin de leur zone. La première est celle de la
 * vendeuse de démo.
 */
export const DEMO_SHOPS: ReadonlyArray<{
  key: string;
  name: string;
  zone: "nord" | "sud";
  street: DemoStreet;
  number: number;
  access: string;
}> = [
  { key: "abbesses", name: "Point de vente des Abbesses", zone: "nord", street: ["rue des Abbesses", "75018", 48.8846, 2.3382], number: 42, access: "Livraison par la porte de service, côté cour. Sonner « Production »." },
  { key: "roquette", name: "Point de vente Roquette", zone: "sud", street: ["rue de la Roquette", "75011", 48.8555, 2.376], number: 15, access: "Rideau levé dès 6h15, déposer en réserve derrière la vitrine." },
];

/** Assortiment envoyé chaque matin à une boutique : pain et pâtisserie, quantités (minimum, maximum). */
export const DEMO_SHOP_ASSORTMENT: ReadonlyArray<readonly [product: string, min: number, max: number]> = [
  ["Baguette tradition", 60, 90],
  ["Baguette classique", 20, 35],
  ["Pain de campagne 400 g", 8, 14],
  ["Pain au levain 500 g", 6, 10],
  ["Pain aux céréales 500 g", 4, 8],
  ["Pain de seigle 500 g", 3, 6],
  ["Pain aux noix", 3, 6],
  ["Croissant au beurre", 40, 60],
  ["Pain au chocolat", 40, 60],
  ["Pain aux raisins", 10, 18],
  ["Éclair au chocolat", 10, 16],
  ["Éclair au café", 6, 10],
  ["Tartelette citron meringuée", 6, 10],
  ["Tartelette aux fraises", 6, 10],
  ["Millefeuille", 6, 10],
  ["Paris-Brest individuel", 4, 8],
  ["Financier", 12, 20],
  ["Macarons (boîte de 6)", 4, 8],
];

/** Commandes de gâteaux des particuliers (LOT2-D9) : clients, inscriptions et consignes. */
export const DEMO_CAKE_CUSTOMERS: ReadonlyArray<readonly [name: string, phone: string, inscription: string | null, note: string | null]> = [
  ["Mme Lemaire", "0612457890", "Joyeux anniversaire Léa", null],
  ["M. Benhamou", "0698231475", null, "Sans alcool dans le sirop"],
  ["Mme Caron", "0745128863", "Félicitations Hugo & Jade", null],
  ["M. Vasseur", "0633904517", "Bon départ Martine", "Allergie aux fruits à coque"],
  ["Mme Tessier", "0677215840", "10 ans déjà !", null],
  ["M. Pruvost", "0621780356", null, null],
  ["Mme Akroun", "0659043218", "Joyeux anniversaire Papa", "Bougies à part"],
  ["M. Delattre", "0614638297", "Bienvenue Gabriel", null],
];
