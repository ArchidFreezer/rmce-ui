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
  /** server uses hyphenated property */
  "level-variance": string;
}
export interface PoisonsPayload {
  poisons: Poison[];
}

/** UI-only form state for Poison (we use camelCase for levelVariance) */
export interface PoisonFormState {
  id: string;
  name: string;
  type: string;
  level: number | string;
  levelVariance: string;
}

export interface Armourtype {
  id: string;
  name: string;
  type: string;
  description: string;
  "min-manoeuvre-mod": number;
  "max-manoeuvre-mod": number;
  "missile-attack-penalty": number;
  "quickness-penalty": number;
  "animal-only": boolean;
  "includes-greaves": boolean;
}

export interface ArmourtypesPayload {
  armourtypes: Armourtype[];
}

/** UI-only form state for armourtype (camelCase for hyphenated fields) */
export interface ArmourtypeFormState {
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