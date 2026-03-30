import { sendJson } from './client';

import type { Realm, Stat } from '../types/enum';

export type CharacterContext = {
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

const STAT_ROLLS_ENDPOINT = '/rmce/operations/character/stat-rolls';
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

export async function applyLevelUpgrade(
  payload: ApplyLevelUpgradeRequest,
): Promise<ApplyLevelUpgradeResponse> {
  return sendJson<ApplyLevelUpgradeResponse>(APPLY_LEVEL_ENDPOINT, 'POST', payload);
}
