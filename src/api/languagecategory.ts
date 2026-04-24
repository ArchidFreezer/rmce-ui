import { fetchJson, sendJson } from './client';

import type {
  LanguageCategory, LanguageCategoriesPayload,
} from '../types';

const BASE = '/rmce/data/languagecategory';

const asString = (v: unknown) => String(v ?? '');

/** GET /rmce/data/languagecategory → { languagecategories: LanguageCategory[] } */
export async function fetchLanguageCategories(): Promise<LanguageCategory[]> {
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
export async function upsertLanguageCategory(
  lc: LanguageCategory,
  opts: { method?: 'POST' | 'PUT' } = {},
) {
  const { method = 'POST' } = opts;
  const url = BASE;
  return sendJson(url, method, lc);
}

/** DELETE /rmce/data/languagecategory/{id} */
export async function deleteLanguageCategory(id: string) {
  if (!id) throw new Error('deleteLanguageCategory: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}