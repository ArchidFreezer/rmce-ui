// src/api/weapontype.ts
import { fetchJson, sendJson } from './client';

import type {
  WeaponType,
  WeaponTypesPayload,
  WeaponTypeRange,
  WeaponTypeCritical,
} from '../types';

/**
 * REST base for WeaponType
 * GET    /rmce/objects/weapontype
 * POST   /rmce/objects/weapontype/
 * PUT    /rmce/objects/weapontype/{id}
 * DELETE /rmce/objects/weapontype/{id}
 */
const BASE = '/rmce/objects/weapontype';

// ---------- small coercion helpers ----------
const asString = (v: unknown) => String(v ?? '');
const asBool = (v: unknown) =>
  v === true || v === 'true' || v === 1 || v === '1';
const asInt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};

function rowRangeFromJson(r: any): WeaponTypeRange {
  return {
    min: asInt(r?.min),
    max: asInt(r?.max),
    modifier: asInt(r?.modifier),
  };
}

function rowCriticalFromJson(c: any): WeaponTypeCritical {
  return {
    critical: asString(c?.critical) as WeaponTypeCritical['critical'],
    modifier: asInt(c?.modifier),
  };
}

function fromJson(x: any): WeaponType {
  return {
    id: asString(x?.id),
    name: asString(x?.name),
    notes: x?.notes != null ? asString(x?.notes) : undefined,

    // references by id
    skill: asString(x?.skill),
    book: asString(x?.book),

    // IMPORTANT: attackTable is a string id (AttackTable.id), not an enum
    attackTable: asString(x?.attackTable),

    // ints
    fumble: asInt(x?.fumble),
    breakage: asInt(x?.breakage),

    minLength: asInt(x?.minLength),
    maxLength: asInt(x?.maxLength),

    minStrength: asInt(x?.minStrength),
    maxStrength: asInt(x?.maxStrength),

    minWeight: asInt(x?.minWeight),
    maxWeight: asInt(x?.maxWeight),

    woodenHaft: asBool(x?.woodenHaft),

    criticals: Array.isArray(x?.criticals)
      ? x.criticals.map(rowCriticalFromJson)
      : [],

    ranges: Array.isArray(x?.ranges)
      ? x.ranges.map(rowRangeFromJson)
      : [],
  };
}

// ---------- API surface ----------

/**
 * Fetch all weapon types.
 * Expects: { weaponTypes: WeaponType[] }
 */
export async function fetchWeaponTypes(): Promise<WeaponType[]> {
  const data = await fetchJson<WeaponTypesPayload>(BASE);
  if (!data || !Array.isArray((data as any).weapontypes)) {
    throw new Error('Unexpected response: expected { weapontypes: [...] }');
  }
  return (data as WeaponTypesPayload).weapontypes.map(fromJson);
}

/**
 * Create or update a weapon type.
 * - POST to /rmce/objects/weapontype/   (useResourceIdPath=false)
 * - PUT  to /rmce/objects/weapontype/{id} (useResourceIdPath=true)
 */
export async function upsertWeaponType(
  w: WeaponType,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {},
) {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url =
    useResourceIdPath && w?.id
      ? `${BASE}/${encodeURIComponent(w.id)}`
      : `${BASE}/`;
  // sendJson handles JSON stringify + headers
  return sendJson(url, method, w);
}

/**
 * Delete a weapon type by id.
 */
export async function deleteWeaponType(id: string) {
  if (!id) throw new Error('deleteWeaponType: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}