import { fetchJson, sendJson } from './client';
import type { ArmourType, ArmourTypesPayload } from '../types/armourtype';

const BASE = '/rmce/objects/armourtype';

export async function fetchArmourTypes(): Promise<ArmourType[]> {
  const data = await fetchJson<ArmourTypesPayload>(`${BASE}`);
  if (!data || !Array.isArray(data.armourtypes)) {
    throw new Error('Unexpected response: expected { armourtypes: [...] }');
  }
  return data.armourtypes;
}

/** Create or update a single armourtype (POST to collection by default). */
export async function upsertArmourType(
  armourtype: ArmourType,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {}
): Promise<unknown> {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url =
    useResourceIdPath && armourtype?.id
      ? `${BASE}/${encodeURIComponent(armourtype.id)}`
      : `${BASE}/`;
  return sendJson(url, method, armourtype);
}

/** DELETE /rmce/objects/armourtype/{id} */
export async function deleteArmourType(id: string): Promise<unknown> {
  if (!id) throw new Error('deleteArmourType: id is required');
  const url = `${BASE}/${encodeURIComponent(id)}`;
  return fetchJson(url, { method: 'DELETE' });
}