import { fetchJson, sendJson } from './client';

import type { Realm, Stat } from '../types/enum';

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

export type InitialChoicesResponse = {
  id: string;
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

const STAT_ROLLS_ENDPOINT = '/rmce/operations/character/stat-rolls';
const INITIAL_CHOICES_ENDPOINT = '/rmce/operations/character/initial-choices';
const APPLY_LEVEL_ENDPOINT = '/rmce/operations/character/apply-level-upgrade';

export type StatRollRequest = {
  temporary: number;
};

export type StatRollResponse = {
  temporary: number;
  potential: number;
};

export async function getStatRollPotentials(
  payload: StatRollRequest[],
): Promise<StatRollResponse[]> {
  return sendJson<StatRollResponse[]>(STAT_ROLLS_ENDPOINT, 'POST', payload);
}

export async function submitInitialChoices(
  payload: InitialChoicesRequest,
): Promise<InitialChoicesResponse> {
  return fetchJson<InitialChoicesResponse>(INITIAL_CHOICES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function applyLevelUpgrade(
  payload: ApplyLevelUpgradeRequest,
): Promise<ApplyLevelUpgradeResponse> {
  return sendJson<ApplyLevelUpgradeResponse>(APPLY_LEVEL_ENDPOINT, 'POST', payload);
}
