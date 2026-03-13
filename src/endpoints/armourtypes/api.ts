import { fetchJson, sendJson } from '../../api/client';
import type { Armourtype, ArmourtypesPayload } from '../../types';

const BASE = '/rmce/objects/armourtype';

export async function fetchArmourtypes(): Promise<Armourtype[]> {
  const data = await fetchJson<ArmourtypesPayload>(`${BASE}`);
  if (!data || !Array.isArray(data.armourtypes)) {
    throw new Error('Unexpected response: expected { armourtypes: [...] }');
  }
  return data.armourtypes;
}

/** Create or update a single armourtype. Default: POST to collection with trailing slash. */
export async function upsertArmourtype(
  armourtype: Armourtype,
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
export async function deleteArmourtype(id: string): Promise<unknown> {
  if (!id) throw new Error('deleteArmourtype: id is required');
  const url = `${BASE}/${encodeURIComponent(id)}`;
  return fetchJson(url, { method: 'DELETE' });
}