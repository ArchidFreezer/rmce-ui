import { fetchJson, sendJson } from './client';

import type { 
  SkillProgressionType, SkillProgressionTypesPayload,
 } from '../types';

const BASE = '/rmce/objects/skillprogressiontype';

function asInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}
const asString = (v: unknown) => String(v ?? '');

export async function fetchSkillProgressionTypes(): Promise<SkillProgressionType[]> {
  const data = await fetchJson<SkillProgressionTypesPayload>(BASE);
  if (!data || !Array.isArray((data as any).skillprogressiontypes)) {
    throw new Error('Unexpected response: expected { skillprogressiontypes: [...] }');
  }
  return (data as SkillProgressionTypesPayload).skillprogressiontypes.map((x) => ({
    id: asString(x.id),
    name: asString(x.name),
    zero: asInt(x.zero),
    ten: asInt(x.ten),
    twenty: asInt(x.twenty),
    thirty: asInt(x.thirty),
    remaining: asInt(x.remaining),
  }));
}

export async function upsertSkillProgressionType(
  spt: SkillProgressionType,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {},
): Promise<unknown> {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && spt?.id
    ? `${BASE}/${encodeURIComponent(spt.id)}`
    : `${BASE}/`;
  return sendJson(url, method, spt);
}

export async function deleteSkillProgressionType(id: string): Promise<void> {
  if (!id) throw new Error('deleteSkillProgressionType: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}