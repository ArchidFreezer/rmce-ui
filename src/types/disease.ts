/**
 * Disease data
 * Note: The API's disease data includes a type, transmission method, description, and a list of severity symptoms. I've defined the types accordingly, with enums for severity levels
 * to ensure consistency in the UI and to make it easier to work with these values in forms and dropdowns. The disease interface captures the structure of the API's disease data, and the 
 * payload interface wraps it in a way that matches the API's response format.
 * 
 * Reuses the Severity type and list defined for poisons, since diseases also have severity levels that affect symptoms. The DiseaseTypeSymptom interface captures the relationship between
 * severity levels and their associated symptoms, which is a key part of the disease data structure.
 */

import { Named } from './base';

export interface Disease extends Named {
  type: string;
  level: number;
  levelVariance: string;
}
export interface DiseasesPayload {
  diseases: Disease[];
}