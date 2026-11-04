export type AddressSuggestion = {
  id: string;
  label: string;
  address: string;
  city: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  score: number;
  /** Numéro tapé absent de la base nationale : le pin indique la rue, pas le numéro. */
  numberUnverified?: boolean;
};

export type AddressFieldValues = {
  address: string;
  city: string;
  postalCode: string;
};
