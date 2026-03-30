import { sendJson } from './client';

import type { Realm, Stat } from '../types/enum';

export type CharacterContext = {
  raceId: string;
  cultureId: string;
  professionId: string;
  realms: Realm[];
};

export type PotentialStatRequest = CharacterContext & {
  temporary?: number | undefined;
  autoGenerate?: boolean | undefined;
  stat?: Stat | undefined;
};

export type PotentialStatResult = {
  temporary: number;
  potential: number;
  stat?: Stat | undefined;
};

export type GeneratePotentialStatsRequest = CharacterContext & {
  stats: Array<{
    temporary?: number | undefined;
    autoGenerate?: boolean | undefined;
    stat?: Stat | undefined;
  }>;
};

export type GeneratePotentialStatsResponse = {
  results: PotentialStatResult[];
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

const POTENTIAL_ENDPOINT = '/rmce/operations/character/potential-stats';
const STAT_ROLLS_ENDPOINT = '/rmce/operations/character/stat-rolls';
const APPLY_LEVEL_ENDPOINT = '/rmce/operations/character/apply-level-upgrade';

export type StatRollRequest = {
  temporary: number;
  potentialRoll: number;
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

export async function generatePotentialStats(
  payload: GeneratePotentialStatsRequest,
): Promise<GeneratePotentialStatsResponse> {
  return sendJson<GeneratePotentialStatsResponse>(POTENTIAL_ENDPOINT, 'POST', payload);
}

export async function generatePotentialStat(
  payload: PotentialStatRequest,
): Promise<PotentialStatResult> {
  const data = await sendJson<GeneratePotentialStatsResponse>(POTENTIAL_ENDPOINT, 'POST', {
    raceId: payload.raceId,
    cultureId: payload.cultureId,
    professionId: payload.professionId,
    realms: payload.realms,
    stats: [
      {
        temporary: payload.temporary,
        autoGenerate: payload.autoGenerate,
        stat: payload.stat,
      },
    ],
  } satisfies GeneratePotentialStatsRequest);

  const first = data.results[0];
  if (!first) {
    throw new Error('Potential stat generation returned no results.');
  }
  return first;
}

export async function applyLevelUpgrade(
  payload: ApplyLevelUpgradeRequest,
): Promise<ApplyLevelUpgradeResponse> {
  return sendJson<ApplyLevelUpgradeResponse>(APPLY_LEVEL_ENDPOINT, 'POST', payload);
}
