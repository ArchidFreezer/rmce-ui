import { MaladySeverity } from './types/enum';

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



export interface PoisonTypeEffectOnset {
  severity: MaladySeverity;
  min: number;
  max: number;
}

export interface PoisonTypeSymptom {
  severity: MaladySeverity;
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



