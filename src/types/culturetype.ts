// src/types/culturetype.ts
import { Named, PersistentValue, SkillValue } from './base';
import { EnvironmentFeature, EnvironmentTerrain, EnvironmentVegetation, EnvironmentWaterBody } from './enum';

export interface CultureType extends Named {
  // Long HTML/text fields
  description?: string | undefined;
  characterConcepts?: string | undefined;
  clothing?: string | undefined;
  aspirations?: string | undefined;
  fears?: string | undefined;
  marriagePatterns?: string | undefined;
  prejudices?: string | undefined;
  religiousBeliefs?: string | undefined;

  /** total hobby ranks to distribute */
  hobbySkillRanks: number;

  /** total adolescent language ranks to distribute */
  adolescentLanguageRanks: number;

  /** total spell list ranks to distribute for Own Realm Open Lists */
  spellListRanks?: number | undefined;

  /** references ArmourType.id */
  preferredArmours: string[];
  /** references WeaponType.id */
  preferredWeapons: string[];

  /** per skill; value is integer; optional subcategory */
  skillRanks: SkillValue[];

  /** per category; value is integer */
  skillCategoryRanks: PersistentValue[];

  /** per category; value is integer (as provided by your JSON) */
  skillCategorySkillRanks: PersistentValue[];

  /** optional references to ClimateType.id */
  requiredClimates?: string[] | undefined;

  /** enums from src/types/enum */
  requiredFeatures?: EnvironmentFeature[] | undefined;      // EnvironmentFeature
  requiredTerrains?: EnvironmentTerrain[] | undefined;      // EnvironmentTerrain
  requiredVegetations?: EnvironmentVegetation[] | undefined;   // EnvironmentVegetation
  requiredWaterSources?: EnvironmentWaterBody[] | undefined;  // EnvironmentWaterBody
}

export interface CultureTypesPayload {
  culturetypes: CultureType[];
}