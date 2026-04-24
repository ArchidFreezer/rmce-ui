import { fetchJson, sendJson } from './client';

import type {
  ArmourType, ArmourTypesPayload,
} from '../types';

const BASE = '/rmce/data/armourtype';

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
  opts: { method?: 'POST' | 'PUT' } = {}
): Promise<unknown> {
  const { method = 'POST' } = opts;
  const url = BASE;
  return sendJson(url, method, armourtype);
}

/** DELETE /rmce/data/armourtype/{id} */
export async function deleteArmourType(id: string): Promise<unknown> {
  if (!id) throw new Error('deleteArmourType: id is required');
  const url = `${BASE}/${encodeURIComponent(id)}`;
  return fetchJson(url, { method: 'DELETE' });
}