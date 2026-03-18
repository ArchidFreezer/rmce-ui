import { fetchJson, sendJson } from './client';
import type { SkillGroup, SkillGroupsPayload } from '../types/skillgroup';

const BASE = '/rmce/objects/skillgroup';

function asString(v: unknown): string {
  return String(v ?? '');
}

/** GET /rmce/objects/skillgroup → { skillgroups: SkillGroup[] } */
export async function fetchSkillgroups(): Promise<SkillGroup[]> {
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
export async function upsertSkillgroup(
  sg: SkillGroup,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {},
): Promise<unknown> {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && sg?.id
    ? `${BASE}/${encodeURIComponent(sg.id)}`
    : `${BASE}/`;
  return sendJson(url, method, sg);
}

/** DELETE /rmce/objects/skillgroup/{id} */
export async function deleteSkillgroup(id: string): Promise<void> {
  if (!id) throw new Error('deleteSkillgroup: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}