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
  minManoeuvreMod: number | string;
  maxManoeuvreMod: number | string;
  missileAttackPenalty: number | string;
  quicknessPenalty: number | string;
  animalOnly: boolean;
  includesGreaves: boolean;
}

export interface ArmourtypesPayload {
  armourtypes: Armourtype[];
}

export type Precipitation =
  | 'Rainy'
  | 'Humid'
  | 'Temperate'
  | 'Dry'
  | 'Arid';

export type Temperature =
  | 'Hot'
  | 'Warm'
  | 'Temperate'
  | 'Cool'
  | 'Cold';

export interface Climate {
  id: string;
  name: string;
  temperature: Temperature; // e.g., "Cold"
  precipitations: Precipitation[];
}

export interface ClimatesPayload {
  climates: Climate[];
}