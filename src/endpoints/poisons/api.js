// src/endpoints/poisons/api.js
import { fetchJson, sendJson } from '../../api/client';

const BASE = '/rmce/objects/poison';

export async function fetchPoisons() {
  const data = await fetchJson(`${BASE}`);
  if (!data || !Array.isArray(data.poisons)) {
    throw new Error('Unexpected response: expected { poisons: [...] }');
  }
  return data.poisons;
}

export async function upsertPoison(poison, opts = {}) {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && poison?.id
    ? `${BASE}/${encodeURIComponent(poison.id)}`
    : `${BASE}/`; // collection path with trailing slash
  return sendJson(url, method, poison);
}
  
/**
 * DELETE /rmce/objects/poison/{id}
 */
export async function deletePoison(id) {
  if (!id) throw new Error('deletePoison: id is required');
  const url = `${BASE}/${encodeURIComponent(id)}`;
  // Use fetchJson so non-2xx throws; tolerate empty body
  return fetchJson(url, { method: 'DELETE' });
}
