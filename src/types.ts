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