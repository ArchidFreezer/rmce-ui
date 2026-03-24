import { fetchJson, sendJson } from './client';

import type { 
  TreasureCode, TreasureCodesPayload,
 } from '../types';

 import { 
  TREASUREVALUETYPES, type TreasureValueType,
 } from '../types/enum';

const BASE = '/rmce/objects/treasurecode';

const asString = (v: unknown) => String(v ?? '');

function asTreasureValueType(v: unknown): TreasureValueType {
  const s = asString(v);
  return (TREASUREVALUETYPES as readonly string[]).includes(s)
    ? (s as TreasureValueType)
    : 'Normal'; // fallback if server ever sends an unknown value
}

/** GET /rmce/objects/treasurecode → { treasurecodes: TreasureCode[] } */
export async function fetchTreasurecodes(): Promise<TreasureCode[]> {
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
export async function upsertTreasurecode(
  tc: TreasureCode,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {},
) {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && tc?.id
    ? `${BASE}/${encodeURIComponent(tc.id)}`
    : `${BASE}/`;
  return sendJson(url, method, tc);
}

/** DELETE /rmce/objects/treasurecode/{id} */
export async function deleteTreasurecode(id: string) {
  if (!id) throw new Error('deleteTreasurecode: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}