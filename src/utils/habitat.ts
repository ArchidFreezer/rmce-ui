import type { Habitat } from '../types';

export const emptyHabitat = (): Habitat => ({
  features: [],
  terrains: [],
  vegetation: [],
  waterSources: [],
  climateGroups: [],
  climateSubGroups: [],
});