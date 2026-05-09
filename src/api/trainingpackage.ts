import { fetchJson, sendJson } from './client';

import type {
  TrainingPackage, TrainingPackagesPayload,
} from '../types';
import type { CharacterTraits } from '../types/base';

const BASE = '/rmce/data/trainingpackage';

const asString = (v: unknown) => String(v ?? '');
const asInt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? '')).filter(Boolean) : [];
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

export async function fetchTrainingPackages(): Promise<TrainingPackage[]> {
  const data = await fetchJson<TrainingPackagesPayload>(BASE);
  if (!data || !Array.isArray((data as any).trainingpackages)) {
    throw new Error('Unexpected response: expected { trainingpackages: [...] }');
  }
  return data.trainingpackages.map((x: any) => ({
    ...x,
    traits: traitsFromJson(x.traits),
  })) as TrainingPackage[];
}

export async function upsertTrainingPackage(
  tp: TrainingPackage,
  opts: { method?: 'POST' | 'PUT' } = {},
) {
  const { method = 'POST' } = opts;
  const url = BASE;
  return sendJson(url, method, tp);
}

export async function deleteTrainingPackage(id: string) {
  if (!id) throw new Error('deleteTrainingPackage: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}