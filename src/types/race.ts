// src/types/race.ts
import type { CreatureSize, CriticalTableType, Stat } from './enum';
import type { LanguageAbility } from './language';

export interface RaceSkillRef {
  id: string;                     // Skill.id
  subcategory?: string | undefined;
}

export interface RaceSkillBonus {
  id: string;                     // Skill.id
  subcategory?: string | undefined;
  value: number;
}

export interface RaceStatBonus {
  id: Stat;
  value: number;
}

export interface RaceSkillCategoryChoice {
  numChoices: number;
  options: string[];              // SkillCategory.id[]
}

export interface Race {
  id: string;
  name: string;
  description?: string | undefined;

  book: string;                   // Book.id

  highCulture: boolean;
  creatureSize: CreatureSize;
  criticalTable: CriticalTableType;

  recoveryMultiplier: number;
  backgroundOptions: number;
  exhaustionBonus: number;
  statLossRacialType: number;
  requiredSleep: number;
  requiredSleepFrequency: number;
  soulDeparture: number;
  buildModifier: number;
  averageMaleHeight: number;
  averageFemaleHeight: number;
  averageLifespan: number;
  maleWeightModifier: number;
  femaleWeightModifier: number;

  arcaneProgression: string;      // SkillProgressionType.id
  armsProgression: string;        // SkillProgressionType.id
  channelingProgression: string;  // SkillProgressionType.id
  essenceProgression: string;     // SkillProgressionType.id
  mentalismProgression: string;   // SkillProgressionType.id

  startingLanguages: LanguageAbility[];
  adolescentLanguages: LanguageAbility[];

  statBonuses: RaceStatBonus[];

  everymanSkills: RaceSkillRef[];
  restrictedSkills: RaceSkillRef[];

  everymanCategories: string[];   // SkillCategory.id[]
  restrictedCategories: string[]; // SkillCategory.id[]

  skillBonuses: RaceSkillBonus[];

  skillCategoryChoicesEveryman: RaceSkillCategoryChoice[];
}

export interface RacesPayload {
  races: Race[];
}