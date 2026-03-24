import { fetchJson, sendJson } from './client';
import type {
  TrainingPackage,
  TrainingPackagesPayload,
} from '../types/trainingpackage';

const BASE = '/rmce/objects/trainingpackage';

const asString = (v: unknown) => String(v ?? '');
const asInt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? '')).filter(Boolean) : [];

export async function fetchTrainingPackages(): Promise<TrainingPackage[]> {
  const data = await fetchJson<TrainingPackagesPayload>(BASE);
  if (!data || !Array.isArray((data as any).trainingpackages)) {
    throw new Error('Unexpected response: expected { trainingpackages: [...] }');
  }
  return data.trainingpackages as TrainingPackage[];
}

export async function upsertTrainingPackage(
  tp: TrainingPackage,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {},
) {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url =
    useResourceIdPath && tp.id
      ? `${BASE}/${encodeURIComponent(tp.id)}`
      : `${BASE}/`;
  return sendJson(url, method, tp);
}

export async function deleteTrainingPackage(id: string) {
  if (!id) throw new Error('deleteTrainingPackage: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}