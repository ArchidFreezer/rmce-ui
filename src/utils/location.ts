import type { Location } from '../types';

export const emptyLocation = (): Location => ({
  features: [],
  terrains: [],
  vegetation: [],
  waterSources: [],
  climateGroups: [],
  climateSubGroups: [],
});