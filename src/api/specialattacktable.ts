import { fetchJson, sendJson } from './client';

import type { 
  AttackTableRow,
  SpecialAttackTable, SpecialAttackTablesPayload,
 } from '../types';

const BASE = '/rmce/objects/specialattacktable';

const asInt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};
const asString = (v: unknown) => String(v ?? '-');

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
  return { min, max, ...normalizeCells(r) };
}

/** GET /rmce/objects/specialattacktable → { specialattacktables: SpecialAttackTable[] } */
export async function fetchSpecialAttackTables(): Promise<SpecialAttackTable[]> {
  const data = await fetchJson<SpecialAttackTablesPayload>(BASE);
  if (!data || !Array.isArray((data as any).specialattacktables)) {
    throw new Error('Unexpected response: expected { specialattacktables: [...] }');
  }
  return (data as SpecialAttackTablesPayload).specialattacktables.map((x: any) => ({
    id: asString(x?.id),
    name: asString(x?.name),
    small: asInt(x?.small),
    medium: asInt(x?.medium),
    large: asInt(x?.large),
    huge: asInt(x?.huge),
    maxRow: asInt(x?.maxRow),
    modifiedRows: Array.isArray(x?.modifiedRows) ? x.modifiedRows.map(rowFromJson) : [],
    unmodifiedRows: Array.isArray(x?.unmodifiedRows) ? x.unmodifiedRows.map(rowFromJson) : undefined,
  }));
}

/** Create or update a single special attack table. */
export async function upsertSpecialAttackTable(
  at: SpecialAttackTable,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {},
) {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && at?.id
    ? `${BASE}/${encodeURIComponent(at.id)}`
    : `${BASE}/`;
  return sendJson(url, method, at);
}

/** DELETE /rmce/objects/specialattacktable/{id} */
export async function deleteSpecialAttackTable(id: string) {
  if (!id) throw new Error('deleteSpecialAttackTable: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}