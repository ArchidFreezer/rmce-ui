import { sendJson } from './client';

import type { Stat } from '../types/enum';
import type { CharacterBuilder, PersistentValue, LanguageAbility, SkillValue } from '../types';

export type SetCharacterBackgroundChoicesRequest = {
  id: string;
  statGains: boolean;
  extraMoney: 0 | 1 | 2;
  backgroundLanguages: LanguageAbility[];
  backgroundSkillBonus: SkillValue[];
  backgroundCategoryBonus: PersistentValue[];
  backgroundItemCount: 0 | 1 | 2;
};

export type ApplyLevelUpgradeRequest = {
  trainingPackageIds: string[];
  statGains: Stat[];
  skillPurchases: Array<{ id: string; subcategory?: string | undefined; purchases: number }>;
  categoryPurchases: Array<{ id: string; purchases: number }>;
  spellListPurchases: Array<{ id: string; purchases: number }>;
  tpResolutions: Array<{
    tpId: string;
    statGainChoices: string[];
    skillRankChoices: Array<Array<{ id: string; subcategory: string; ranks: number }>>;
    categoryMultiSkillChoices: Array<Array<{ id: string; subcategory: string; ranks: number }>>;
    groupMultiSkillChoices: Array<Array<{ id: string; subcategory: string; ranks: number }>>;
    groupCategoryAndSkillChoices: Array<{ categoryId: string; skillId: string; subcategory: string }>;
    spellListChoices: Array<Array<{ id: string; ranks: number }>>;
    spellListCategoryChoices: Array<Array<{ id: string; ranks: number }>>;
    lifestyleCategorySkillChoices: string[][];
    languageChoices: string[][];
  }>;
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
  payload: CharacterBuilder,
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

export async function setCharacterStats(
  payload: CharacterBuilder,
): Promise<CharacterBuilder> {
  return sendJson<CharacterBuilder>(SET_STATS_ENDPOINT, 'POST', payload);
}

export async function setCharacterHobbyChoices(
  payload: CharacterBuilder,
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
