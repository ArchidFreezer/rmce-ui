import { fetchJson, sendJson } from './client';

import type { 
  Disease, DiseasesPayload,
 } from '../types';

const BASE = '/rmce/objects/disease';

export async function fetchDiseases(): Promise<Disease[]> {
  const data = await fetchJson<DiseasesPayload>(`${BASE}`);
  if (!data || !Array.isArray(data.diseases)) {
    throw new Error('Unexpected response: expected { diseases: [...] }');
  }
  return data.diseases;
}

export async function upsertDisease(
  disease: Disease,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {}
): Promise<unknown> {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url =
    useResourceIdPath && disease?.id
      ? `${BASE}/${encodeURIComponent(disease.id)}`
      : `${BASE}/`;
  return sendJson(url, method, disease);
}

export async function deleteDisease(id: string): Promise<unknown> {
  if (!id) throw new Error('deleteDisease: id is required');
  const url = `${BASE}/${encodeURIComponent(id)}`;
  return fetchJson(url, { method: 'DELETE' });
}