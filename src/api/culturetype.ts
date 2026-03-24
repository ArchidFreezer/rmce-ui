// src/api/culturetype.ts
import { fetchJson, sendJson } from './client';

import type { 
  CategoryRankValue,
  CultureType, CultureTypesPayload,
  SkillRankValue,
 } from '../types';

 import { 
  asFeatureArray, 
  asTerrainArray, 
  asVegetationArray, 
  asWaterBodyArray,
 } from '../types/enum';

const BASE = '/rmce/objects/culturetype';

// Coercion helpers
const asString = (v: unknown) => String(v ?? '');
const asInt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? '')).filter(Boolean) : [];


function rowSkillRankFromJson(r: any): SkillRankValue {
  const out: SkillRankValue = {
    id: asString(r?.id),
    value: asInt(r?.value),
  };
  if (r?.subcategory != null) out.subcategory = asString(r.subcategory);
  return out;
}
function rowCategoryRankFromJson(r: any): CategoryRankValue {
  return {
    id: asString(r?.id),
    value: asInt(r?.value),
  };
}

function fromJson(x: any): CultureType {
  return {
    id: asString(x?.id),
    name: asString(x?.name),

    description: x?.description != null ? asString(x?.description) : undefined,
    characterConcepts: x?.characterConcepts != null ? asString(x?.characterConcepts) : undefined,
    clothing: x?.clothing != null ? asString(x?.clothing) : undefined,
    aspirations: x?.aspirations != null ? asString(x?.aspirations) : undefined,
    fears: x?.fears != null ? asString(x?.fears) : undefined,
    marriagePatterns: x?.marriagePatterns != null ? asString(x?.marriagePatterns) : undefined,
    prejudices: x?.prejudices != null ? asString(x?.prejudices) : undefined,
    religiousBeliefs: x?.religiousBeliefs != null ? asString(x?.religiousBeliefs) : undefined,

    hobbySkillRanks: asInt(x?.hobbySkillRanks),

    preferredArmours: asStringArray(x?.preferredArmours),
    preferredWeapons: asStringArray(x?.preferredWeapons),

    skillRanks: Array.isArray(x?.skillRanks) ? x.skillRanks.map(rowSkillRankFromJson) : [],
    skillCategoryRanks: Array.isArray(x?.skillCategoryRanks)
      ? x.skillCategoryRanks.map(rowCategoryRankFromJson)
      : [],
    skillCategorySkillRanks: Array.isArray(x?.skillCategorySkillRanks)
      ? x.skillCategorySkillRanks.map(rowCategoryRankFromJson)
      : [],

    requiredClimates: x?.requiredClimates != null ? asStringArray(x?.requiredClimates) : undefined,
    requiredFeatures: x?.requiredFeatures != null ? asFeatureArray(x?.requiredFeatures) : undefined,
    requiredTerrains: x?.requiredTerrains != null ? asTerrainArray(x?.requiredTerrains) : undefined,
    requiredVegetations: x?.requiredVegetations != null ? asVegetationArray(x?.requiredVegetations) : undefined,
    requiredWaterSources: x?.requiredWaterSources != null ? asWaterBodyArray(x?.requiredWaterSources) : undefined,
  };
}

// ---------- API surface ----------
export async function fetchCulturetypes(): Promise<CultureType[]> {
  const data = await fetchJson<CultureTypesPayload>(BASE);
  if (!data || !Array.isArray((data as any).culturetypes)) {
    throw new Error('Unexpected response: expected { culturetypes: [...] }');
  }
  return (data as CultureTypesPayload).culturetypes.map(fromJson);
}

export async function upsertCulturetype(
  c: CultureType,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {},
) {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url =
    useResourceIdPath && c?.id
      ? `${BASE}/${encodeURIComponent(c.id)}`
      : `${BASE}/`;
  return sendJson(url, method, c);
}

export async function deleteCulturetype(id: string) {
  if (!id) throw new Error('deleteCulturetype: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}