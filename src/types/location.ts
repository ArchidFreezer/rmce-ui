import type {
  EnvironmentFeature,
  EnvironmentTerrain,
  EnvironmentVegetation,
  EnvironmentWaterBody,
} from './enum';

export interface Location {
  features: EnvironmentFeature[];
  terrains: EnvironmentTerrain[];
  vegetation: EnvironmentVegetation[];
  waterSources: EnvironmentWaterBody[];
  climates: string[];
}
