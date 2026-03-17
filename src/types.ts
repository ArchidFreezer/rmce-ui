export interface PrefixesPayload {
  prefixes: string[];
}

/**
 * Book data
 * Note: The API's book data is pretty straightforward, with a simple structure that includes an ID, code, name, abbreviation, and ISBN. I've defined the types accordingly, 
 * but we may want to add some additional fields or relationships in the future if the API expands or if we need to link books to other entities in the UI (e.g., characters, poisons, etc.).
 */
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

/**
 * Poison type data
 * Note: The API's poison type data is a bit complex, with multiple nested arrays for severity effects and symptoms. I've tried to capture this structure in the types below,
 * but it may need further refinement once we see the actual data and how it's used in the UI. The severity levels are defined as a separate type and list for easy reuse in forms and dropdowns.
 */

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

/** Enum plus reusable list for form dropdowns */
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

/**
 * Armour data
 * Note: Armourtype is a bit of an odd name, but it matches the API and avoids confusion with the Armour interface used for character equipment.
 * The API's "armourtype" is more like a template or category of armour, while the actual "armour" items that characters wear would be instances of these types.
 */
export interface ArmourType {
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

export interface ArmourTypesPayload {
  armourtypes: ArmourType[];
}

/**
 * Climate data
 * Note: The API's climate data includes a name, temperature category, and a list of precipitation types. I've defined the types accordingly, with enums for temperature and precipitation
 * to ensure consistency in the UI and to make it easier to work with these values in forms and dropdowns. The climate interface captures the structure of the API's climate data, and the 
 * payload interface wraps it in a way that matches the API's response format.
 */

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

/**
 * Disease data
 * Note: The API's disease data includes a type, transmission method, description, and a list of severity symptoms. I've defined the types accordingly, with enums for severity levels
 * to ensure consistency in the UI and to make it easier to work with these values in forms and dropdowns. The disease interface captures the structure of the API's disease data, and the 
 * payload interface wraps it in a way that matches the API's response format.
 * 
 * Reuses the Severity type and list defined for poisons, since diseases also have severity levels that affect symptoms. The DiseaseTypeSymptom interface captures the relationship between
 * severity levels and their associated symptoms, which is a key part of the disease data structure.
 */

export interface Disease {
  id: string;
  name: string;
  type: string;
  level: number;
  levelVariance: string;
}
export interface DiseasesPayload {
  diseases: Disease[];
}
// --- Disease Types ---
export interface DiseaseTypeSymptom {
  severity: Severity;
  symptoms: string;
}

export interface DiseaseType {
  id: string;
  type: string;           // “Bubonic”, “Chemical”, etc.
  transmission: string;   // “Injection”, “Ingestion”, ...
  description: string;
  severitySymptoms: DiseaseTypeSymptom[]; // exactly 4 entries (Mild..Extreme)
}

export interface DiseaseTypesPayload {
  diseasetypes: DiseaseType[];
}

/**
 * CreaturePace data
 */
export interface CreaturePace {
  id: string;
  name: string;
  exhaustionMultiplier: number;   // accepts scientific notation on input; stored as number
  movementMultiplier: number;     // accepts scientific notation on input; stored as number
  manoeuvreDifficulty: ManoeuvreDifficulty;    // free text or pick from suggested difficulties below
}

export interface CreaturePacesPayload {
  creaturepaces: CreaturePace[];
}

export type ManoeuvreDifficulty = 'Normal' | 'Routine' | 'Easy' | 'Light' | 'Medium' | 'Hard' | 'Very Hard' | 'Extremely Hard' | 'Sheer Folly' | 'Absurd'
export const MANOEUVRE_DIFFICULTIES: ReadonlyArray<ManoeuvreDifficulty> = [
  'Normal', 'Routine', 'Easy', 'Light', 'Medium', 'Hard', 'Very Hard', 'Extremely Hard', 'Sheer Folly', 'Absurd'
] as const;
