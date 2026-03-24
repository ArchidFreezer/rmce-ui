import { fetchJson, sendJson } from './client';

import type { 
  AttackTable, AttackTablesPayload, AttackTableRow,
 } from '../types';

const BASE = '/rmce/objects/attacktable';

const asInt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};
const asString = (v: unknown) => String(v ?? '-');

/** Ensure an object contains at1..at20 strings; default '-' for missing cells. */
function normalizeCells(obj: any): Pick<AttackTableRow,
  'at1'|'at2'|'at3'|'at4'|'at5'|'at6'|'at7'|'at8'|'at9'|'at10'|
  'at11'|'at12'|'at13'|'at14'|'at15'|'at16'|'at17'|'at18'|'at19'|'at20'
> {
  const out: any = {};
  for (let i = 1; i <= 20; i++) {
    const key = `at${i}`;
    out[key] = asString(obj?.[key]);
  }
  return out as any;
}

function rowFromJson(r: any): AttackTableRow {
  const min = asInt(r?.min);
  const max = asInt(r?.max);
  return {
    min, max,
    ...normalizeCells(r),
  };
}

/** GET /rmce/objects/attacktable → { attacktables: AttackTable[] } */
export async function fetchAttacktables(): Promise<AttackTable[]> {
  const data = await fetchJson<AttackTablesPayload>(BASE);
  if (!data || !Array.isArray((data as any).attacktables)) {
    throw new Error('Unexpected response: expected { attacktables: [...] }');
  }
  return (data as AttackTablesPayload).attacktables.map((x: any) => ({
    id: asString(x?.id),
    name: asString(x?.name),
    maxRow: asInt(x?.maxRow),
    modifiedRows: Array.isArray(x?.modifiedRows) ? x.modifiedRows.map(rowFromJson) : [],
    unmodifiedRows: Array.isArray(x?.unmodifiedRows) ? x.unmodifiedRows.map(rowFromJson) : undefined,
  }));
}

/** Create or update a single attack table. */
export async function upsertAttacktable(
  at: AttackTable,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {},
) {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && at?.id
    ? `${BASE}/${encodeURIComponent(at.id)}`
    : `${BASE}/`;
  return sendJson(url, method, at);
}

/** DELETE /rmce/objects/attacktable/{id} */
export async function deleteAttacktable(id: string) {
  if (!id) throw new Error('deleteAttacktable: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}