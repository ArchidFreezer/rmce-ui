import { fetchJson, sendJson } from './client';

import type { 
  SkillGroup, SkillGroupsPayload,
 } from '../types';

const BASE = '/rmce/objects/skillgroup';

function asString(v: unknown): string {
  return String(v ?? '');
}

/** GET /rmce/objects/skillgroup → { skillgroups: SkillGroup[] } */
export async function fetchSkillGroups(): Promise<SkillGroup[]> {
  const data = await fetchJson<SkillGroupsPayload>(BASE);
  if (!data || !Array.isArray((data as any).skillgroups)) {
    throw new Error('Unexpected response: expected { skillgroups: [...] }');
  }
  return (data as SkillGroupsPayload).skillgroups.map(s => ({
    id: asString(s.id),
    name: asString(s.name),
  }));
}

/** Create or update a single skill group. */
export async function upsertSkillGroup(
  sg: SkillGroup,
  opts: { method?: 'POST' | 'PUT' } = {},
): Promise<unknown> {
  const { method = 'POST' } = opts;
  const url = BASE;
  return sendJson(url, method, sg);
}

/** DELETE /rmce/objects/skillgroup/{id} */
export async function deleteSkillGroup(id: string): Promise<void> {
  if (!id) throw new Error('deleteSkillGroup: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}