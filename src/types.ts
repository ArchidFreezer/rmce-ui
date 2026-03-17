export interface PrefixesPayload {
  prefixes: string[];
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


