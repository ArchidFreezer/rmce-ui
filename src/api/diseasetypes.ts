import { fetchJson, sendJson } from './client';
import type { DiseaseType, DiseaseTypesPayload, Severity } from '../types';
import { SEVERITIES } from '../types';

const BASE = '/rmce/objects/diseasetype';

// sanitize helpers
function isSeverity(v: unknown): v is Severity {
  return typeof v === 'string' && (SEVERITIES as readonly string[]).includes(v);
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
export async function fetchDiseasetypes(): Promise<DiseaseType[]> {
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
export async function upsertDiseasetype(
  dt: DiseaseType,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {}
): Promise<unknown> {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && dt?.id
    ? `${BASE}/${encodeURIComponent(dt.id)}`
    : `${BASE}/`;
  return sendJson(url, method, dt);
}

/** DELETE /rmce/objects/diseasetype/{id} */
export async function deleteDiseasetype(id: string): Promise<void> {
  if (!id) throw new Error('deleteDiseasetype: id is required');
  const url = `${BASE}/${encodeURIComponent(id)}`;
  await fetchJson<void>(url, { method: 'DELETE' });
}