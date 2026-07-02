import type {
  EnvironmentFeature,
  EnvironmentTerrain,
  EnvironmentVegetation,
  EnvironmentWaterBody,
  KoppenClimateGroup,
  KoppenClimateSubgroup,
} from './enum';

export interface Location {
  features: EnvironmentFeature[];
  terrains: EnvironmentTerrain[];
  vegetation: EnvironmentVegetation[];
  waterSources: EnvironmentWaterBody[];
  climateGroups: KoppenClimateGroup[];
  climateSubGroups: KoppenClimateSubgroup[];
}
