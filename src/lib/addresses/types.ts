export type AddressSuggestion = {
  id: string;
  label: string;
  address: string;
  city: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  score: number;
};

export type AddressFieldValues = {
  address: string;
  city: string;
  postalCode: string;
};
