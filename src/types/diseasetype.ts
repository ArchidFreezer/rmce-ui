import { Persistent } from './base';
import { MaladySeverity } from './enum';
// --- Disease Types ---
export interface DiseaseTypeSymptom {
  severity: MaladySeverity;
  symptoms: string;
}

export interface DiseaseType extends Persistent {
  type: string;           // “Bubonic”, “Chemical”, etc.
  transmission: string;   // “Injection”, “Ingestion”, ...
  description: string;
  severitySymptoms: DiseaseTypeSymptom[]; // exactly 4 entries (Mild..Extreme)
}

export interface DiseaseTypesPayload {
  diseasetypes: DiseaseType[];
}