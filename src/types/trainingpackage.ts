import type { Stat } from './enum';
import type { Named, PersistentValue, SkillValue } from './base';

export interface TrainingPackageQualifier {
  qualifier: string;
  reduction: number;
}

export interface TrainingPackageSpecial {
  value: string;
  chance: number;
}

export interface TrainingPackageSkillRankChoice {
  numChoices: number;
  value: number;
  options: Array<{
    id: string;                     // Skill.id
    subcategory?: string | undefined;
  }>;
}

export interface TrainingPackageCategoryMultiSkillChoice {
  id: string;                       // SkillCategory.id
  value: number;
  numChoices: number;
}

export interface TrainingPackageGroupMultiSkillChoice {
  id: string;                       // SkillGroup.id
  value: number;
  numChoices: number;
}

export interface TrainingPackageSpellListRank {
  optionalCategory?: string | undefined; // SkillCategory.id
  value: number;
  numChoices: number;
  options: string[];                // SpellList.id[]
}

export interface TrainingPackageSpellListCategoryRankChoice {
  value: number;
  numChoices: number;
  options: string[];                // SkillCategory.id[]
}

export interface TrainingPackageLanguageChoice {
  numChoices: number;
  value: number;
  options: string[];                // Language.id[]
}

export interface TrainingPackage extends Named {
  description?: string | undefined;
  flavourText?: string | undefined;

  book: string;                     // Book.id

  notes: string[];
  races: string[];                  // Race.id[]

  qualifiers: TrainingPackageQualifier[];

  lifestyle: boolean;
  timeToAcquire: number;
  startingMoneyModifierDice: string;

  specials: TrainingPackageSpecial[];

  statGains: Stat[];
  realmStatGain: boolean;

  statGainChoices?: {
    numChoices: number;
    options: Stat[];
  } | undefined;

  skillRanks: SkillValue[];
  skillRankChoices: TrainingPackageSkillRankChoice[];

  categoryRanks: PersistentValue[];
  categoryMultiSkillRankChoices: TrainingPackageCategoryMultiSkillChoice[];
  groupMultiSkillRankChoices: TrainingPackageGroupMultiSkillChoice[];
  groupCategoryAndSkillRankChoices: PersistentValue[];

  spellListRanks: TrainingPackageSpellListRank[];
  spellListCategoryRankChoices: TrainingPackageSpellListCategoryRankChoice[];

  lifestyleSkills: Array<{ id: string; subcategory?: string | undefined }>;
  lifestyleCategories: string[];
  lifestyleGroups: string[];

  lifestyleCategorySkillChoices: Array<{
    numChoices: number;
    options: string[];               // SkillCategory.id[]
  }>;

  languageChoices: TrainingPackageLanguageChoice[];
}

export interface TrainingPackagesPayload {
  trainingpackages: TrainingPackage[];
}
