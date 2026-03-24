import { fetchJson, sendJson } from './client';

import type { 
  Climate, ClimatesPayload,
 } from '../types';

 import { 
  PRECIPITATIONS, Precipitation, 
  TEMPERATURES, Temperature,
 } from '../types/enum';

const PRECIP_ENUM: ReadonlySet<Precipitation> = new Set(PRECIPITATIONS);

const TEMP_ENUM: ReadonlySet<Temperature> = new Set(TEMPERATURES);

function sanitizePrecipitations(arr: unknown): Precipitation[] {
  if (!Array.isArray(arr)) return [];
  const out: Precipitation[] = [];
  for (const v of arr) {
    const s = String(v) as Precipitation;
    if (PRECIP_ENUM.has(s)) out.push(s);
  }
  return out;
}

function sanitizeTemperature(v: unknown): Temperature {
  const s = String(v) as Temperature;
  return TEMP_ENUM.has(s) ? s : 'Temperate';
}

/**
 * GET /rmce/objects/climate  ->  { climates: Climate[] }
 */
export async function fetchClimates(): Promise<Climate[]> {
  const data = await fetchJson<ClimatesPayload>('/rmce/objects/climate');
  if (!data || !Array.isArray(data.climates)) {
    throw new Error('Unexpected response: expected { climates: Climate[] }');
  }
  return data.climates.map((c) => ({
    id: String(c.id),
    name: String(c.name),
    temperature: sanitizeTemperature(c.temperature),
    precipitations: sanitizePrecipitations(c.precipitations),
  }));
}

/**
 * Create or update a single climate.
 * - Create: POST /rmce/objects/climate/   (body = Climate)
 * - Edit:   PUT  /rmce/objects/climate/{id}
 */
export async function upsertClimate(
  climate: Climate,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {}
): Promise<unknown> {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && climate?.id
    ? `/rmce/objects/climate/${encodeURIComponent(climate.id)}`
    : `/rmce/objects/climate/`;
  return sendJson(url, method, climate);
}

/**
 * DELETE /rmce/objects/climate/{id}
 */
export async function deleteClimate(id: string): Promise<void> {
  if (!id) throw new Error('deleteClimate: id is required');
  const url = `/rmce/objects/climate/${encodeURIComponent(id)}`;
  await fetchJson<void>(url, { method: 'DELETE' });
}
