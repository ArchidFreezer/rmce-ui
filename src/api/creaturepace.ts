// src/api/creaturepace.ts
import { fetchJson, sendJson } from './client';

import type { 
  CreaturePace, CreaturePacesPayload,
 } from '../types';

import { 
  MANOEUVRE_DIFFICULTIES, ManoeuvreDifficulty,
 } from '../types/enum';

const BASE = '/rmce/objects/creaturepace';

function asNumber(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : NaN;
}

function asDifficulty(v: unknown): ManoeuvreDifficulty {
  const s = String(v ?? '');
  return (MANOEUVRE_DIFFICULTIES as readonly string[]).includes(s)
    ? (s as ManoeuvreDifficulty)
    : 'Normal'; // fallback if server ever sends an unknown value
}

/** GET /rmce/objects/creaturepace → { creaturepaces: CreaturePace[] } */
export async function fetchCreaturePaces(): Promise<CreaturePace[]> {
  const data = await fetchJson<CreaturePacesPayload>(BASE);
  if (!data || !Array.isArray(data.creaturepaces)) {
    throw new Error('Unexpected response: expected { creaturepaces: [...] }');
  }
  return data.creaturepaces.map((c) => ({
    id: String(c.id),
    name: String(c.name),
    exhaustionMultiplier: asNumber(c.exhaustionMultiplier),
    movementMultiplier: asNumber(c.movementMultiplier),
    manoeuvreDifficulty: asDifficulty(c.manoeuvreDifficulty),
  }));
}

/** Create or update a single CreaturePace. */
export async function upsertCreaturePace(
  cp: CreaturePace,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {},
): Promise<unknown> {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && cp?.id
    ? `${BASE}/${encodeURIComponent(cp.id)}`
    : `${BASE}/`;
  // cp is already strongly typed; no extra casting
  return sendJson(url, method, cp);
}

export async function deleteCreaturePace(id: string): Promise<void> {
  if (!id) throw new Error('deleteCreaturePace: id is required');
  const url = `${BASE}/${encodeURIComponent(id)}`;
  await fetchJson<void>(url, { method: 'DELETE' });
}
