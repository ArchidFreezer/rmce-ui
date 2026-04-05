import { Persistent, MaladySymptom } from './base';
import { MaladySeverity } from './enum';
// --- Disease Types ---



export interface DiseaseType extends Persistent {
  type: string;           // “Bubonic”, “Chemical”, etc.
  transmission: string;   // “Injection”, “Ingestion”, ...
  description: string;
  severitySymptoms: MaladySymptom[]; // exactly 4 entries (Mild..Extreme)
}

export interface DiseaseTypesPayload {
  diseasetypes: DiseaseType[];
}