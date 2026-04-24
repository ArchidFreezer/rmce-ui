import { fetchJson, sendJson } from './client';

import type {
  Character, CharactersPayload,
} from '../types';

const BASE = '/rmce/objects/character';

export async function fetchCharacters(): Promise<Character[]> {
  const data = await fetchJson<CharactersPayload>(`${BASE}`);
  if (!data || !Array.isArray(data.characters)) {
    throw new Error('Unexpected response: expected { characters: [...] }');
  }
  return data.characters;
}

/** Create or update a single character. Default: POST to collection. */
export async function upsertCharacter(
  character: Character,
  opts: { method?: 'POST' | 'PUT' } = {}
): Promise<unknown> {
  const { method = 'POST' } = opts;
  return sendJson(BASE, method, character);
}

/** DELETE /rest/objects/character/{id} */
export async function deleteCharacter(id: string): Promise<unknown> {
  if (!id) throw new Error('deleteCharacter: id is required');
  const url = `${BASE}/${encodeURIComponent(id)}`;
  return fetchJson(url, { method: 'DELETE' });
}
