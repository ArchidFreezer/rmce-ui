import { sendJson } from './client';

import type { Character, CharacterBuilder, CharacterLeveller, PersistentValue, LanguageAbility, SkillValue } from '../types';

export type SetCharacterBackgroundChoicesRequest = {
  id: string;
  statGains: boolean;
  extraMoney: 0 | 1 | 2;
  backgroundLanguages: LanguageAbility[];
  backgroundSkillBonus: SkillValue[];
  backgroundCategoryBonus: PersistentValue[];
  backgroundItemCount: 0 | 1 | 2;
};

const PRIMARY_DEFINITION_ENDPOINT = '/rmce/operations/character/primary-definition';
const PRIMARY_CHOICES_ENDPOINT = '/rmce/operations/character/primary-choices';
const STAT_ROLLS_ENDPOINT = '/rmce/operations/character/stat-rolls';
const SET_STATS_ENDPOINT = '/rmce/operations/character/set-stats';
const SET_PHYSIQUE_ENDPOINT = '/rmce/operations/character/set-physique';
const SET_HOBBY_CHOICES_ENDPOINT = '/rmce/operations/character/set-hobby-choices';
const SET_BACKGROUND_CHOICES_ENDPOINT = '/rmce/operations/character/set-background-choices';
const LEVEL_UP_ENDPOINT = '/rmce/operations/character/levelup';

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

export async function setCharacterPhysique(
  payload: CharacterBuilder,
): Promise<CharacterBuilder> {
  return sendJson<CharacterBuilder>(SET_PHYSIQUE_ENDPOINT, 'POST', payload);
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

/** Initial call – send a CharacterLeveller payload with only 'character' populated to get back trainingPackageCosts from the server. */
export async function initiateCharacterLevelUp(
  characterId: string,
): Promise<CharacterLeveller> {
  const payload: CharacterLeveller = {
    id: '',
    character: characterId,
    trainingPackageCosts: [],
    trainingPackages: [],
    statGains: [],
    skillRanks: [],
    categoryRanks: [],
    spellListRanks: [],
    languageAbilities: [],
  };
  return sendJson<CharacterLeveller>(LEVEL_UP_ENDPOINT, 'POST', payload);
}

/** Final call – send completed CharacterLeveller payload to apply the level-up. */
export async function levelUpCharacter(
  payload: CharacterLeveller,
): Promise<Character> {
  return sendJson<Character>(LEVEL_UP_ENDPOINT, 'POST', payload);
}
