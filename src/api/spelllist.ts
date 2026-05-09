import { fetchJson, sendJson } from './client';

import type {
  SpellList, SpellListsPayload,
} from '../types';
import type { CharacterTraits } from '../types/base';

import {
  SPELL_TYPES, SpellType,
  SPELL_REALMS, Realm,
} from '../types/enum';

const BASE = '/rmce/data/spelllist';

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
const asTraitInt = (v: unknown): number => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? Math.min(9, Math.max(1, n)) : 5;
};
function traitsFromJson(t: unknown): CharacterTraits {
  const x = (t && typeof t === 'object') ? t as Record<string, unknown> : {};
  return {
    caster: asTraitInt(x['caster']),
    combat: asTraitInt(x['combat']),
    information: asTraitInt(x['information']),
    stealth: asTraitInt(x['stealth']),
    support: asTraitInt(x['support']),
    utility: asTraitInt(x['utility']),
  };
}

/** GET /rmce/data/spelllist → { spelllists: SpellList[] } */
export async function fetchSpellLists(): Promise<SpellList[]> {
  const data = await fetchJson<SpellListsPayload>(BASE);
  if (!data || !Array.isArray(data.spelllists)) {
    throw new Error('Unexpected response: expected { spelllists: [...] }');
  }
  return data.spelllists.map(s => ({
    id: String(s.id),
    name: String(s.name),
    book: String(s.book ?? ''),
    type: asSpellType(s.type),
    description: String(s.description ?? ''),
    evil: asBool(s.evil),
    summoning: asBool(s.summoning),
    directed: asBool(s.directed),
    realms: asRealmArray(s.realms),
    traits: traitsFromJson(s.traits),
  }));
}

/** Create/Update one SpellList */
export async function upsertSpellList(
  sl: SpellList,
  opts: { method?: 'POST' | 'PUT' } = {}
): Promise<unknown> {
  const { method = 'POST' } = opts;
  const url = BASE;
  return sendJson(url, method, sl);
}

/** DELETE /rmce/data/spelllist/{id} */
export async function deleteSpellList(id: string): Promise<void> {
  if (!id) throw new Error('deleteSpellList: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}