import { fetchJson, sendJson } from './client';

import type { 
  DiseaseType, DiseaseTypesPayload,
 } from '../types';

import { 
  MALADY_SEVERITIES, MaladySeverity,
 } from '../types/enum';

const BASE = '/rmce/objects/diseasetype';

// sanitize helpers
function isSeverity(v: unknown): v is MaladySeverity {
  return typeof v === 'string' && (MALADY_SEVERITIES as readonly string[]).includes(v);
}
function sanitizeSymptoms(arr: unknown): DiseaseType['severitySymptoms'] {
  if (!Array.isArray(arr)) return [];
  const out: DiseaseType['severitySymptoms'] = [];
  for (const r of arr) {
    const o = r as Partial<DiseaseType['severitySymptoms'][number]>;
    if (isSeverity(o?.severity) && typeof o?.symptoms === 'string') {
      out.push({ severity: o.severity, symptoms: o.symptoms });
    }
  }
  return out;
}

/** GET /rmce/objects/diseasetype → { diseasetypes: DiseaseType[] } */
export async function fetchDiseaseTypes(): Promise<DiseaseType[]> {
  const data = await fetchJson<DiseaseTypesPayload>(BASE);
  if (!data || !Array.isArray(data.diseasetypes)) {
    throw new Error('Unexpected response: expected { diseasetypes: [...] }');
  }
  return data.diseasetypes.map((d) => ({
    id: String(d.id),
    type: String(d.type),
    transmission: String(d.transmission ?? ''),
    description: String(d.description ?? ''),
    severitySymptoms: sanitizeSymptoms(d.severitySymptoms),
  }));
}

/** Create or update a single disease type. */
export async function upsertDiseaseType(
  dt: DiseaseType,
  opts: { method?: 'POST' | 'PUT' } = {}
): Promise<unknown> {
  const { method = 'POST' } = opts;
  const url = BASE;
  return sendJson(url, method, dt);
}

/** DELETE /rmce/objects/diseasetype/{id} */
export async function deleteDiseaseType(id: string): Promise<void> {
  if (!id) throw new Error('deleteDiseaseType: id is required');
  const url = `${BASE}/${encodeURIComponent(id)}`;
  await fetchJson<void>(url, { method: 'DELETE' });
}