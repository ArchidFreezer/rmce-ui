import { MaladySeverity } from './enum';

// This file defines the TypeScript types for poison types, which are used in the API and throughout the app.

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