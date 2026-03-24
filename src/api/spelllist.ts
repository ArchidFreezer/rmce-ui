import { fetchJson, sendJson } from './client';

import type { 
  SpellList, SpellListsPayload,
 } from '../types';

import { 
  SPELL_TYPES, SpellType, 
  SPELL_REALMS, Realm,
 } from '../types/enum';

const BASE = '/rmce/objects/spelllist';

// Sanitizers
function asSpellType(v: unknown): SpellType {
  const s = String(v ?? '');
  return (SPELL_TYPES as readonly string[]).includes(s) ? (s as SpellType) : 'Open';
}
function asRealmArray(v: unknown): Realm[] {
  if (!Array.isArray(v)) return [];
  const set = new Set(SPELL_REALMS);
  return v
    .map(x => String(x))
    .filter((x): x is Realm => set.has(x as Realm));
}
function asBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

/** GET /rmce/objects/spelllist → { spelllists: SpellList[] } */
export async function fetchSpelllists(): Promise<SpellList[]> {
  const data = await fetchJson<SpellListsPayload>(BASE);
  if (!data || !Array.isArray(data.spelllists)) {
    throw new Error('Unexpected response: expected { spelllists: [...] }');
  }
  return data.spelllists.map(s => ({
    id: String(s.id),
    name: String(s.name),
    book: String(s.book ?? ''),
    type: asSpellType(s.type),
    evil: asBool(s.evil),
    summoning: asBool(s.summoning),
    realms: asRealmArray(s.realms),
  }));
}

/** Create/Update one SpellList */
export async function upsertSpelllist(
  sl: SpellList,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {}
): Promise<unknown> {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && sl?.id
    ? `${BASE}/${encodeURIComponent(sl.id)}`
    : `${BASE}/`;
  return sendJson(url, method, sl);
}

/** DELETE /rmce/objects/spelllist/{id} */
export async function deleteSpelllist(id: string): Promise<void> {
  if (!id) throw new Error('deleteSpelllist: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}