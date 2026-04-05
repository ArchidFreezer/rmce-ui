import { sendJson } from './client';

import type { Realm, Stat } from '../types/enum';
import type { CharacterBuilder, PersistentValue, LanguageAbility, SkillValue } from '../types';

export type CharacterContext = {
  name?: string;
  raceId: string;
  cultureId: string;
  professionId: string;
  realms: Realm[];
};

export type InitialChoicesRequest = {
  name: string;
  race: string;
  culture: string;
  profession: string;
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

const STAT_ROLLS_ENDPOINT = '/rmce/operations/character/stat-rolls';
const INITIAL_CHOICES_ENDPOINT = '/rmce/operations/character/initial-choices';
const APPLY_LEVEL_ENDPOINT = '/rmce/operations/character/apply-level-upgrade';
const SET_STATS_ENDPOINT = '/rmce/operations/character/set-stats';
const SET_HOBBY_CHOICES_ENDPOINT = '/rmce/operations/character/set-hobby-choices';
export type StatRollRequest = {
  temporary: number;
};

export type StatRollResponse = {
  temporary: number;
  potential: number;
};

export async function submitInitialChoices(
  payload: InitialChoicesRequest,
): Promise<CharacterBuilder> {
  return sendJson<CharacterBuilder>(INITIAL_CHOICES_ENDPOINT, 'POST', payload);
}

export async function getStatRollPotentials(
  payload: StatRollRequest[],
): Promise<StatRollResponse[]> {
  return sendJson<StatRollResponse[]>(STAT_ROLLS_ENDPOINT, 'POST', payload);
}

export async function applyLevelUpgrade(
  payload: ApplyLevelUpgradeRequest,
): Promise<ApplyLevelUpgradeResponse> {
  return sendJson<ApplyLevelUpgradeResponse>(APPLY_LEVEL_ENDPOINT, 'POST', payload);
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
