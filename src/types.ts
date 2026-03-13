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
