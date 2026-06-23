import { fetchJson, sendJson } from './client';

import type {
  Foragable,
  ForagablesPayload,
} from '../types/foragable';

import {
  FORAGABLE_EFFECT_TYPES,
  FORAGABLE_PREPARATION_TYPES,
  MANOEUVRE_DIFFICULTIES,
  asFeatureArray,
  asTerrainArray,
  asVegetationArray,
  asWaterBodyArray,
  type ForagableEffectType,
  type ForagablePreparationType,
  type ManoeuvreDifficulty,
} from '../types/enum';

const BASE = '/rmce/data/foragable';

const asString = (v: unknown) => String(v ?? '');
const asInt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? '')).filter(Boolean) : [];

function asEnumValue<T extends string>(values: readonly T[], v: unknown, fallback: T): T {
  const s = asString(v);
  return (values as readonly string[]).includes(s) ? (s as T) : fallback;
}

function fromJson(x: any): Foragable {
  return {
    id: asString(x?.id),
    name: asString(x?.name),
    loreSkill: asString(x?.loreSkill),
    characteristics: x?.characteristics != null ? asString(x.characteristics) : undefined,
    medicinalUses: x?.medicinalUses != null ? asString(x.medicinalUses) : undefined,
    otherUses: x?.otherUses != null ? asString(x.otherUses) : undefined,
    warning: x?.warning != null ? asString(x.warning) : undefined,
    preparationType: asEnumValue(FORAGABLE_PREPARATION_TYPES, x?.preparationType, 'Ingest' as ForagablePreparationType),

    effectType: asEnumValue(FORAGABLE_EFFECT_TYPES, x?.effectType, 'General Purpose' as ForagableEffectType),
    findDifficulty: asEnumValue(MANOEUVRE_DIFFICULTIES, x?.findDifficulty, 'Medium' as ManoeuvreDifficulty),
    addictionFactor: asInt(x?.addictionFactor),
    cost: x?.cost != null ? asString(x.cost) : undefined,
    location: x?.location != null
      ? {
        features: asFeatureArray(x.location.features),
        terrains: asTerrainArray(x.location.terrains),
        vegetation: asVegetationArray(x.location.vegetation),
        waterSources: asWaterBodyArray(x.location.waterSources),
        climates: asStringArray(x.location.climates),
      }
      : undefined,
  };
}

export async function fetchForagables(): Promise<Foragable[]> {
  const data = await fetchJson<ForagablesPayload>(BASE);
  if (!data || !Array.isArray((data as any).foragables)) {
    throw new Error('Unexpected response: expected { foragables: [...] }');
  }
  return (data as any).foragables.map(fromJson);
}

export async function upsertForagable(
  foragable: Foragable,
  opts: { method?: 'POST' | 'PUT' } = {},
) {
  const { method = 'POST' } = opts;
  return sendJson(BASE, method, foragable);
}

export async function deleteForagable(id: string) {
  if (!id) throw new Error('deleteForagable: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
