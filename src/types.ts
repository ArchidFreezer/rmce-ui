export interface PrefixesPayload {
  prefixes: string[];
}

export interface Book {
  id: string;
  code: number;
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

// src/types.ts

export type Severity = 'Mild' | 'Moderate' | 'Severe' | 'Extreme';
export const SEVERITIES: ReadonlyArray<Severity> = ['Mild', 'Moderate', 'Severe', 'Extreme'] as const;

export interface PoisonTypeEffectOnset {
  severity: Severity;
  min: number;
  max: number;
}

export interface PoisonTypeSymptom {
  severity: Severity;
  symptoms: string;
}

export interface PoisonType {
  id: string;
  type: string;                // e.g., "Circulatory"
  areasAffected: string;       // comma-separated list in a single string
  severityEffectOnsets: PoisonTypeEffectOnset[];
  severitySymptoms: PoisonTypeSymptom[];
}

export interface PoisonTypesPayload {
  poisontypes: PoisonType[];
}

export interface Armourtype {
  id: string;
  name: string;
  type: string;
  description: string;
  minManoeuvreMod: number;
  maxManoeuvreMod: number;
  missileAttackPenalty: number;
  quicknessPenalty: number;
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




