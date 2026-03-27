import type {
  AnimalOutlookType,
  AttackSizeType,
  CreatureBonusXpType,
  CreatureConstitutionVarianceType,
  CreatureMovementSpeedType,
  CreatureSize,
  CriticalModifierType,
  CriticalSize,
  CriticalSizeTableType,
  CriticalType,
  EnvironmentFeature,
  EnvironmentTerrain,
  EnvironmentVegetation,
  EnvironmentWaterBody,
  LevelVarianceType,
} from './enum';

export interface AnimalLocation {
  features: EnvironmentFeature[];
  terrains: EnvironmentTerrain[];
  vegetation: EnvironmentVegetation[];
  waterSources: EnvironmentWaterBody[];
  climates: string[];
}

export interface AnimalNonWeaponAttack {
  table: string;
  size: AttackSizeType;
}

export interface AnimalAttackBase {
  offensiveBonus: number;
  weaponAttack?: string | undefined;
  nonWeaponAttack?: AnimalNonWeaponAttack | undefined;
  useAllAttacks: boolean;
  attacksPerRound: number;
  special?: string | undefined;
  poison?: string | undefined;
  disease?: string | undefined;
  autoCriticalType?: CriticalType | undefined;
  autoCriticalSize?: CriticalSize | undefined;
  sameRoundConditionalAttackId?: number | undefined;
  nextRoundConditionalAttackId?: number | undefined;
}

export interface AnimalStandardAttack extends AnimalAttackBase {
  chanceMin: number;
  chanceMax: number;
}

export interface AnimalRangedAttack extends AnimalAttackBase {
  range: number;
}

export interface AnimalConditionalAttack extends AnimalAttackBase {
  id: number;
}

export interface AnimalGroupAttack extends AnimalAttackBase {
  minGroupSize: number;
}

export interface Animal {
  id: string;
  name: string;
  description?: string | undefined;
  frequencyCode: number;
  bonusXpCode: CreatureBonusXpType;
  constitutionVarianceType: CreatureConstitutionVarianceType;
  levelVarianceType: LevelVarianceType;
  treasureCode?: string | undefined;
  size: CreatureSize;
  /** references ArmourType.type */
  armourType?: string | undefined;
  movementSpeed: CreatureMovementSpeedType;
  attackQuickness: CreatureMovementSpeedType;
  maxPace?: string | undefined;
  outlook: AnimalOutlookType;
  criticalTable: CriticalSizeTableType;
  criticalModifiers: CriticalModifierType[];
  location?: AnimalLocation | undefined;
  standardAttacks: AnimalStandardAttack[];
  rangedAttacks: AnimalRangedAttack[];
  conditionalAttacks: AnimalConditionalAttack[];
  groupAttacks: AnimalGroupAttack[];
}

export interface AnimalsPayload {
  animals: Animal[];
}