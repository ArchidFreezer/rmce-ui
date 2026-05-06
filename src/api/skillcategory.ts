import { fetchJson, sendJson } from './client';

import type {
  SkillCategory, SkillCategoriesPayload,
} from '../types';
import type { CharacterTraits } from '../types/base';

import {
  STATS, type Stat,
} from '../types/enum';

const BASE = '/rmce/data/skillcategory';

const asString = (v: unknown) => String(v ?? '');
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';
const STAT_SET = new Set<Stat>(STATS);
const asTraitInt = (v: unknown): number => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? Math.min(9, Math.max(1, n)) : 5;
};

function traitsFromJson(t: unknown): CharacterTraits {
  const x = (t && typeof t === 'object') ? t as Record<string, unknown> : {};
  return {
    caster: asTraitInt(x['caster']),
    combat: asTraitInt(x['combat']),
    information: asTraitInt(x['information']),
    stealth: asTraitInt(x['stealth']),
    support: asTraitInt(x['support']),
    utility: asTraitInt(x['utility']),
  };
}

/** Preserve order & duplicates but filter to known Stat values */
function asStatArray(v: unknown): Stat[] {
  if (!Array.isArray(v)) return [];
  const out: Stat[] = [];
  for (const x of v) {
    const s = String(x) as Stat;
    if (STAT_SET.has(s)) out.push(s);
  }
  return out;
}

/** GET /rmce/data/skillcategory → { skillcategories: SkillCategory[] } */
export async function fetchSkillCategories(): Promise<SkillCategory[]> {
  const data = await fetchJson<SkillCategoriesPayload>(BASE);
  if (!data || !Array.isArray((data as any).skillcategories)) {
    throw new Error('Unexpected response: expected { skillcategories: [...] }');
  }
  return (data as SkillCategoriesPayload).skillcategories.map((x) => ({
    id: asString(x.id),
    group: asString(x.group),
    name: asString(x.name),
    useRealmStats: asBool((x as any).useRealmStats),
    skillProgression: asString(x.skillProgression),
    categoryProgression: asString(x.categoryProgression),
    stats: asStatArray((x as any).stats),
    traits: traitsFromJson((x as any).traits),
  }));
}

/** Create or update a single skill category. */
export async function upsertSkillCategory(
  sc: SkillCategory,
  opts: { method?: 'POST' | 'PUT' } = {},
) {
  const { method = 'POST' } = opts;
  const url = BASE;
  return sendJson(url, method, sc);
}

/** DELETE /rmce/data/skillcategory/{id} */
export async function deleteSkillCategory(id: string) {
  if (!id) throw new Error('deleteSkillCategory: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}