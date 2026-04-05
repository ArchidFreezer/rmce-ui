import { MaladySeverity } from './enum';
import { Persistent, MaladySymptom } from './base';

// This file defines the TypeScript types for poison types, which are used in the API and throughout the app.

export interface PoisonTypeEffectOnset {
  severity: MaladySeverity;
  min: number;
  max: number;
}

export interface PoisonType extends Persistent {
  type: string;                // e.g., "Circulatory"
  areasAffected: string;       // comma-separated list in a single string
  severityEffectOnsets: PoisonTypeEffectOnset[];
  severitySymptoms: MaladySymptom[];
}

export interface PoisonTypesPayload {
  poisontypes: PoisonType[];
}