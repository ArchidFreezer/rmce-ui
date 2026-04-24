import { fetchJson, sendJson } from './client';

import type {
  TreasureCode, TreasureCodesPayload,
} from '../types';

import {
  TREASUREVALUETYPES, type TreasureValueType,
} from '../types/enum';

const BASE = '/rmce/data/treasurecode';

const asString = (v: unknown) => String(v ?? '');

function asTreasureValueType(v: unknown): TreasureValueType {
  const s = asString(v);
  return (TREASUREVALUETYPES as readonly string[]).includes(s)
    ? (s as TreasureValueType)
    : 'Normal'; // fallback if server ever sends an unknown value
}

/** GET /rmce/data/treasurecode → { treasurecodes: TreasureCode[] } */
export async function fetchTreasureCodes(): Promise<TreasureCode[]> {
  const data = await fetchJson<TreasureCodesPayload>(BASE);
  if (!data || !Array.isArray((data as any).treasurecodes)) {
    throw new Error('Unexpected response: expected { treasurecodes: [...] }');
  }
  return (data as TreasureCodesPayload).treasurecodes.map((x) => ({
    id: asString(x.id),
    itemsValueType: asTreasureValueType(x.itemsValueType),
    wealthValueType: asTreasureValueType(x.wealthValueType),
  }));
}

/** Create or update a single treasure code. */
export async function upsertTreasureCode(
  tc: TreasureCode,
  opts: { method?: 'POST' | 'PUT' } = {},
) {
  const { method = 'POST' } = opts;
  const url = BASE;
  return sendJson(url, method, tc);
}

/** DELETE /rmce/data/treasurecode/{id} */
export async function deleteTreasureCode(id: string) {
  if (!id) throw new Error('deleteTreasureCode: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}