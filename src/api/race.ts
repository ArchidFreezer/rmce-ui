// src/api/race.ts
import { fetchJson, sendJson } from './client';

import type {
  LanguageRank,
  Race,
  RacesPayload,
  RaceSkillRef,
  RaceSkillBonus,
  RaceStatBonus,
  RaceSkillCategoryChoice,
} from '../types';

const BASE = '/rmce/objects/race';

const asString = (v: unknown) => String(v ?? '');
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';
const asInt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};
const asFloat = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? '')).filter(Boolean) : [];

function languageRankFromJson(x: any): LanguageRank {
  const out: LanguageRank = {
    language: asString(x?.language),
    spoken: asInt(x?.spoken),
    written: asInt(x?.written),
  };
  if (x?.somatic != null) out.somatic = asInt(x.somatic);
  return out;
}

function skillRefFromJson(x: any): RaceSkillRef {
  const out: RaceSkillRef = {
    id: asString(x?.id),
  };
  if (x?.subcategory != null) out.subcategory = asString(x.subcategory);
  return out;
}

function skillBonusFromJson(x: any): RaceSkillBonus {
  const out: RaceSkillBonus = {
    id: asString(x?.id),
    value: asInt(x?.value),
  };
  if (x?.subcategory != null) out.subcategory = asString(x.subcategory);
  return out;
}

function statBonusFromJson(x: any): RaceStatBonus {
  return {
    id: asString(x?.id) as RaceStatBonus['id'],
    value: asInt(x?.value),
  };
}

function categoryChoiceFromJson(x: any): RaceSkillCategoryChoice {
  return {
    numChoices: asInt(x?.['num-choices'] ?? x?.numChoices),
    options: asStringArray(x?.options),
  };
}

function fromJson(x: any): Race {
  return {
    id: asString(x?.id),
    name: asString(x?.name),
    description: x?.description != null ? asString(x?.description) : undefined,

    book: asString(x?.book),

    highCulture: asBool(x?.highCulture),
    creatureSize: asString(x?.creatureSize) as Race['creatureSize'],
    criticalTable: asString(x?.criticalTable) as Race['criticalTable'],

    recoveryMultiplier: asFloat(x?.recoveryMultiplier),
    backgroundOptions: asInt(x?.backgroundOptions),
    exhaustionBonus: asInt(x?.exhaustionBonus),
    statLossRacialType: asInt(x?.statLossRacialType),
    requiredSleep: asInt(x?.requiredSleep),
    requiredSleepFrequency: asInt(x?.requiredSleepFrequency),
    soulDeparture: asInt(x?.soulDeparture),
    buildModifier: asInt(x?.buildModifier),
    averageMaleHeight: asInt(x?.averageMaleHeight),
    averageFemaleHeight: asInt(x?.averageFemaleHeight),
    averageLifespan: asInt(x?.averageLifespan),
    maleWeightModifier: asInt(x?.maleWeightModifier),
    femaleWeightModifier: asInt(x?.femaleWeightModifier),

    arcaneProgression: asString(x?.arcaneProgression),
    armsProgression: asString(x?.armsProgression),
    channelingProgression: asString(x?.channelingProgression),
    essenceProgression: asString(x?.essenceProgression),
    mentalismProgression: asString(x?.mentalismProgression),

    startingLanguages: Array.isArray(x?.startingLanguages)
      ? x.startingLanguages.map(languageRankFromJson)
      : [],
    adolescentLanguages: Array.isArray(x?.adolescentLanguages)
      ? x.adolescentLanguages.map(languageRankFromJson)
      : [],

    statBonuses: Array.isArray(x?.statBonuses)
      ? x.statBonuses.map(statBonusFromJson)
      : [],

    everymanSkills: Array.isArray(x?.everymanSkills)
      ? x.everymanSkills.map(skillRefFromJson)
      : [],
    restrictedSkills: Array.isArray(x?.restrictedSkills)
      ? x.restrictedSkills.map(skillRefFromJson)
      : [],

    everymanCategories: asStringArray(x?.everymanCategories),
    restrictedCategories: asStringArray(x?.restrictedCategories),

    skillBonuses: Array.isArray(x?.skillBonuses)
      ? x.skillBonuses.map(skillBonusFromJson)
      : [],

    skillCategoryChoicesEveryman: Array.isArray(x?.skillCategoryChoicesEveryman)
      ? x.skillCategoryChoicesEveryman.map(categoryChoiceFromJson)
      : [],
  };
}

export async function fetchRaces(): Promise<Race[]> {
  const data = await fetchJson<RacesPayload>(BASE);
  if (!data || !Array.isArray((data as any).races)) {
    throw new Error('Unexpected response: expected { races: [...] }');
  }
  return (data as RacesPayload).races.map(fromJson);
}

export async function upsertRace(
  r: Race,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {},
) {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url =
    useResourceIdPath && r?.id
      ? `${BASE}/${encodeURIComponent(r.id)}`
      : `${BASE}/`;
  return sendJson(url, method, r);
}

export async function deleteRace(id: string) {
  if (!id) throw new Error('deleteRace: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}