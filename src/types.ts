export interface PrefixesPayload {
  prefixes: string[];
}

export interface Book {
  id: string;
  code: string;
  name: string;
  abbreviation: string;
  isbn: string;
}
export interface BooksPayload {
  books: Book[];
}

export interface Poison {
  id: string;
  name: string;
  type: string;
  level: number;
  levelVariance: string;
}
export interface PoisonsPayload {
  poisons: Poison[];
}


export interface Armourtype {
  id: string;
  name: string;
  type: string;
  description: string;
  minManoeuvreMod: string;
  maxManoeuvreMod: string;
  missileAttackPenalty: string;
  quicknessPenalty: string;
  animalOnly: boolean;
  includesGreaves: boolean;
}

export interface ArmourtypesPayload {
  armourtypes: Armourtype[];
}

/** Enum plus reusable list for form checkboxes */
export type Precipitation = 'Rainy' | 'Humid' | 'Temperate' | 'Dry' | 'Arid';
export const PRECIPITATIONS: ReadonlyArray<Precipitation> = [
  'Rainy',
  'Humid',
  'Temperate',
  'Dry',
  'Arid',
] as const;

/** Enum plus reusable list for form checkboxes */
export type Temperature = 'Hot' | 'Warm' | 'Temperate' | 'Cool' | 'Cold';
export const TEMPERATURES: ReadonlyArray<Temperature> = [
  'Hot',
  'Warm',
  'Temperate',
  'Cool',
  'Cold',
] as const;

export interface Climate {
  id: string;
  name: string;
  temperature: Temperature; // e.g., "Cold"
  precipitations: Precipitation[];
}

export interface ClimatesPayload {
  climates: Climate[];
}




