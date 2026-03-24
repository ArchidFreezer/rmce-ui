import { fetchJson, sendJson } from './client';

import type { 
  Skill, SkillsPayload,
 } from '../types';

const BASE = '/rmce/objects/skill';

const asString = (v: unknown) => String(v ?? '');
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';
const asFloat = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(x => String(x ?? '')).filter(s => s.length > 0) : [];
}

export async function fetchSkills(): Promise<Skill[]> {
  const data = await fetchJson<SkillsPayload>(BASE);
  if (!data || !Array.isArray((data as any).skills)) {
    throw new Error('Unexpected response: expected { skills: [...] }');
  }
  return (data as SkillsPayload).skills.map((x: any) => ({
    id: asString(x.id),
    name: asString(x.name),
    category: asString(x.category),
    description: x.description != null ? asString(x.description) : undefined,
    book: asString(x.book),
    action: asString(x.action) as Skill['action'],
    difficultiesSummary: x.difficultiesSummary != null ? asString(x.difficultiesSummary) : undefined,
    notes: x.notes != null ? asString(x.notes) : undefined,
    isRestricted: asBool(x.isRestricted),
    canSpecialise: asBool(x.canSpecialise),
    mandatorySubcategory: asBool(x.mandatorySubcategory),
    subcategories: asStringArray(x.subcategories),
    stats: asStringArray(x.stats) as Skill['stats'],
    exhaustion: asFloat(x.exhaustion),
    distanceMultiplier: asFloat(x.distanceMultiplier),
  }));
}

export async function upsertSkill(
  skill: Skill,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {},
) {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && skill?.id
    ? `${BASE}/${encodeURIComponent(skill.id)}`
    : `${BASE}/`;
  return sendJson(url, method, skill);
}

export async function deleteSkill(id: string) {
  if (!id) throw new Error('deleteSkill: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}