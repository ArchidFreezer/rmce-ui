// src/api/climate.ts
import { fetchJson } from './client';
import type { Climate, ClimatesPayload, Precipitation, Temperature } from '../types';

const PRECIP_ENUM: ReadonlySet<Precipitation> = new Set([
  'Rainy', 'Humid', 'Temperate', 'Dry', 'Arid',
]);

function sanitizePrecipitations(arr: unknown): Precipitation[] {
  if (!Array.isArray(arr)) return [];
  const out: Precipitation[] = [];
  for (const v of arr) {
    const s = String(v) as Precipitation;
    if (PRECIP_ENUM.has(s)) out.push(s);
  }
  return out;
}

const TEMP_ENUM: ReadonlySet<Temperature> = new Set([
  'Hot', 'Warm', 'Temperate', 'Cool', 'Cold',
]);

function sanitizeTemperature(v: unknown): Temperature {
  const s = String(v) as Temperature;
  return TEMP_ENUM.has(s) ? s : 'Temperate';
}

/**
 * GET /rmce/climate -> { climates: Climate[] }
 */
export async function fetchClimates(): Promise<Climate[]> {
  const data = await fetchJson<ClimatesPayload>('/rmce/objects/climate');
  if (!data || !Array.isArray(data.climates)) {
    throw new Error('Unexpected response: expected { climates: Climate[] }');
  }
  // sanitize precipitations to allowed enum values
  return data.climates.map((c) => ({
    id: String(c.id),
    name: String(c.name),
    temperature: sanitizeTemperature(c.temperature),
    precipitations: sanitizePrecipitations(c.precipitations),
  }));
}