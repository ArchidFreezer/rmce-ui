import { fetchJson, sendJson } from './client';

import type { 
  Poison, PoisonsPayload,
 } from '../types';

const BASE = '/rmce/objects/poison';

export async function fetchPoisons(): Promise<Poison[]> {
  const data = await fetchJson<PoisonsPayload>(`${BASE}`);
  if (!data || !Array.isArray(data.poisons)) {
    throw new Error('Unexpected response: expected { poisons: [...] }');
  }
  return data.poisons;
}

export async function upsertPoison(
  poison: Poison,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {}
): Promise<unknown> {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url =
    useResourceIdPath && poison?.id
      ? `${BASE}/${encodeURIComponent(poison.id)}`
      : `${BASE}/`;
  return sendJson(url, method, poison);
}

export async function deletePoison(id: string): Promise<unknown> {
  if (!id) throw new Error('deletePoison: id is required');
  const url = `${BASE}/${encodeURIComponent(id)}`;
  return fetchJson(url, { method: 'DELETE' });
}