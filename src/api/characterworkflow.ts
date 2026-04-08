import { sendJson } from './client';

import type { Realm, Stat } from '../types/enum';
import type { CharacterBuilder, PersistentValue, LanguageAbility, SkillValue } from '../types';

export type PrimaryDefinitionRequest = {
  name: string;
  race: string;
  culture: string;
  profession: string;
  realms: Realm[];
};

export type SetCharacterBuilderStatsRequest = {
  id: string;
  stats: Array<{
    stat: Stat;
    temporary: number;
    potential: number;
  }>;
};

export type SetCharacterBuilderStatsResponse = {
  numHobbyRanks: number;
  hobbySkills: SkillValue[]; // Skill.id + optional subcategory
  hobbyCategories: PersistentValue[]; // SkillCategory.id
  numLanguageRanks: number;
  adolescentLanguages: LanguageAbility[]; // language + spoken/written/somatic ranks
  numSpellListRanks: number;
  adolescentSpellLists: string[]; // SpellList.id[]
};

export type SetCharacterHobbyChoicesRequest = {
  id: string;
  hobbyRanks: SkillValue[]; // Skill.id + optional subcategory
  hobbyCategoryRanks: PersistentValue[]; // SkillCategory.id
  adolescentLanguages: LanguageAbility[]; // language + spoken/written/somatic ranks
  adolescentSpellList: string | null; // SpellList.id
};

export type SetCharacterBackgroundChoicesRequest = {
  id: string;
  statGains: boolean;
  extraMoney: 0 | 1 | 2;
  backgroundLanguages: LanguageAbility[];
  backgroundSkillBonus: PersistentValue[];
  backgroundCategoryBonus: PersistentValue[];
  backgroundItemCount: 0 | 1 | 2;
};

export type CharacterContext = {
  name?: string;
  raceId: string;
  cultureId: string;
  professionId: string;
  realms: Realm[];
};

export type ApplyLevelUpgradeRequest = {
  character: CharacterContext;
  temporaryStats: Record<Stat, number>;
  potentialStats: Record<Stat, number>;
  selectedAdolescentSkills: {
    predefinedSkillIds: string[];
    selectedRaceCategoryChoices: string[][];
    selectedProfessionSkillChoices: string[][];
  };
  selectedBackgroundOptions: string[];
  apprenticeship: {
    trainingPackageId: string;
    selectedStatGainChoices: Stat[];
    selectedSkillRankChoices: Array<Array<{ id: string; subcategory?: string | undefined }>>;
  };
};

export type ApplyLevelUpgradeResponse = {
  message?: string | undefined;
  level?: number | undefined;
  [key: string]: unknown;
};

const PRIMARY_DEFINITION_ENDPOINT = '/rmce/operations/character/primary-definition';
const PRIMARY_CHOICES_ENDPOINT = '/rmce/operations/character/primary-choices';
const STAT_ROLLS_ENDPOINT = '/rmce/operations/character/stat-rolls';
const SET_STATS_ENDPOINT = '/rmce/operations/character/set-stats';
const SET_HOBBY_CHOICES_ENDPOINT = '/rmce/operations/character/set-hobby-choices';
const SET_BACKGROUND_CHOICES_ENDPOINT = '/rmce/operations/character/set-background-choices';
const APPLY_LEVEL_ENDPOINT = '/rmce/operations/character/apply-level-upgrade';

export type StatRollRequest = {
  temporary: number;
};

export type StatRollResponse = {
  temporary: number;
  potential: number;
};

export async function setPrimaryDefinition(
  payload: PrimaryDefinitionRequest,
): Promise<CharacterBuilder> {
  return sendJson<CharacterBuilder>(PRIMARY_DEFINITION_ENDPOINT, 'POST', payload);
}

export async function setCharacterPrimaryChoices(
  payload: CharacterBuilder,
): Promise<CharacterBuilder> {
  return sendJson<CharacterBuilder>(PRIMARY_CHOICES_ENDPOINT, 'POST', payload);
}

export async function getStatRollPotentials(
  payload: StatRollRequest[],
): Promise<StatRollResponse[]> {
  return sendJson<StatRollResponse[]>(STAT_ROLLS_ENDPOINT, 'POST', payload);
}

export async function setCharacterBuilderStats(
  payload: SetCharacterBuilderStatsRequest,
): Promise<SetCharacterBuilderStatsResponse> {
  return sendJson<SetCharacterBuilderStatsResponse>(SET_STATS_ENDPOINT, 'POST', payload);
}

export async function setCharacterHobbyChoices(
  payload: SetCharacterHobbyChoicesRequest,
): Promise<CharacterBuilder> {
  return sendJson<CharacterBuilder>(SET_HOBBY_CHOICES_ENDPOINT, 'POST', payload);
}

export async function setCharacterBackgroundChoices(
  payload: SetCharacterBackgroundChoicesRequest,
): Promise<CharacterBuilder> {
  return sendJson<CharacterBuilder>(SET_BACKGROUND_CHOICES_ENDPOINT, 'POST', payload);
}

export async function applyLevelUpgrade(
  payload: ApplyLevelUpgradeRequest,
): Promise<ApplyLevelUpgradeResponse> {
  return sendJson<ApplyLevelUpgradeResponse>(APPLY_LEVEL_ENDPOINT, 'POST', payload);
}
