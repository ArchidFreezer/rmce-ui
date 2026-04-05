import { Named } from './base';
import { Precipitation, Temperature } from './enum';

/**
 * Climate data
 * Note: The API's climate data includes a name, temperature category, and a list of precipitation types. I've defined the types accordingly, with enums for temperature and precipitation
 * to ensure consistency in the UI and to make it easier to work with these values in forms and dropdowns. The climate interface captures the structure of the API's climate data, and the 
 * payload interface wraps it in a way that matches the API's response format.
 */
export interface Climate extends Named {
  temperature: Temperature; // e.g., "Cold"
  precipitations: Precipitation[];
}

export interface ClimatesPayload {
  climates: Climate[];
}