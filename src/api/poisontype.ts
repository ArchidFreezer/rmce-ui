// src/api/poisontype.ts
import { fetchJson, sendJson } from './client';

import type {
  PoisonType,  PoisonTypesPayload,  PoisonTypeEffectOnset,  PoisonTypeSymptom,
} from '../types';

import { 
  MALADY_SEVERITIES, MaladySeverity,
 } from '../types/enum';

const BASE = '/rmce/objects/poisontype';

function isSeverity(s: unknown): s is MaladySeverity {
  return typeof s === 'string' && (MALADY_SEVERITIES as readonly string[]).includes(s);
}

function sanitizeOnsets(arr: unknown): PoisonTypeEffectOnset[] {
  if (!Array.isArray(arr)) return [];
  const out: PoisonTypeEffectOnset[] = [];
  for (const r of arr) {
    const o = r as Partial<PoisonTypeEffectOnset>;
    if (isSeverity(o?.severity) && Number.isFinite(Number(o.min)) && Number.isFinite(Number(o.max))) {
      out.push({ severity: o.severity, min: Number(o.min), max: Number(o.max) });
    }
  }
  return out;
}

function sanitizeSymptoms(arr: unknown): PoisonTypeSymptom[] {
  if (!Array.isArray(arr)) return [];
  const out: PoisonTypeSymptom[] = [];
  for (const r of arr) {
    const o = r as Partial<PoisonTypeSymptom> & { symptoms?: unknown };
    if (isSeverity(o?.severity) && typeof o?.symptoms === 'string') {
      out.push({ severity: o.severity, symptoms: o.symptoms });
    }
  }
  return out;
}

/** GET /rmce/objects/poisontype → { poisontypes: PoisonType[] } */
export async function fetchPoisonTypes(): Promise<PoisonType[]> {
  const data = await fetchJson<PoisonTypesPayload>(`${BASE}`);
  if (!data || !Array.isArray(data.poisontypes)) {
    throw new Error('Unexpected response: expected { poisontypes: [...] }');
  }
  // ensure stable shape
  return data.poisontypes.map((p) => ({
    id: String(p.id),
    type: String(p.type),
    areasAffected: String(p.areasAffected ?? ''),
    severityEffectOnsets: sanitizeOnsets(p.severityEffectOnsets),
    severitySymptoms: sanitizeSymptoms(p.severitySymptoms),
  }));
}

/** Create or update a single poison type. */
export async function upsertPoisonType(
  pt: PoisonType,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {}
): Promise<unknown> {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && pt?.id
    ? `${BASE}/${encodeURIComponent(pt.id)}`
    : `${BASE}/`;
  return sendJson(url, method, pt);
}

/** DELETE /rmce/objects/poisontype/{id} */
export async function deletePoisonType(id: string): Promise<void> {
  if (!id) throw new Error('deletePoisonType: id is required');
  const url = `${BASE}/${encodeURIComponent(id)}`;
  await fetchJson<void>(url, { method: 'DELETE' });
}