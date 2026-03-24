import { fetchJson, sendJson } from './client';

import type { 
  LanguageCategory, LanguageCategoriesPayload,
 } from '../types';

const BASE = '/rmce/objects/languagecategory';

const asString = (v: unknown) => String(v ?? '');

/** GET /rmce/objects/languagecategory → { languagecategories: LanguageCategory[] } */
export async function fetchLanguagecategories(): Promise<LanguageCategory[]> {
  const data = await fetchJson<LanguageCategoriesPayload>(BASE);
  if (!data || !Array.isArray((data as any).languagecategories)) {
    throw new Error('Unexpected response: expected { languagecategories: [...] }');
  }
  return (data as LanguageCategoriesPayload).languagecategories.map((x) => ({
    id: asString(x.id),
    name: asString(x.name),
  }));
}

/** Create or update a single language category. */
export async function upsertLanguagecategory(
  lc: LanguageCategory,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {},
) {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && lc?.id
    ? `${BASE}/${encodeURIComponent(lc.id)}`
    : `${BASE}/`;
  return sendJson(url, method, lc);
}

/** DELETE /rmce/objects/languagecategory/{id} */
export async function deleteLanguagecategory(id: string) {
  if (!id) throw new Error('deleteLanguagecategory: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}