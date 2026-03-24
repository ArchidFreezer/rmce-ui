import { fetchJson, sendJson } from './client';

import type { 
  Language, LanguagesPayload,
 } from '../types';

const BASE = '/rmce/objects/language';

const asString = (v: unknown) => String(v ?? '');
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';

/** GET /rmce/objects/language → { languages: Language[] } */
export async function fetchLanguages(): Promise<Language[]> {
  const data = await fetchJson<LanguagesPayload>(BASE);
  if (!data || !Array.isArray((data as any).languages)) {
    throw new Error('Unexpected response: expected { languages: [...] }');
  }
  return (data as LanguagesPayload).languages.map((x) => ({
    id: asString(x.id),
    name: asString(x.name),
    category: asString(x.category),
    baseLanguage: x.baseLanguage != null ? asString(x.baseLanguage) : undefined,
    isSpoken: asBool((x as any).isSpoken),
    isWritten: asBool((x as any).isWritten),
    isSomatic: asBool((x as any).isSomatic),
  }));
}

/** Create or update a single language. */
export async function upsertLanguage(
  lang: Language,
  opts: { method?: 'POST' | 'PUT'; useResourceIdPath?: boolean } = {},
) {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && lang?.id
    ? `${BASE}/${encodeURIComponent(lang.id)}`
    : `${BASE}/`;
  return sendJson(url, method, lang);
}

/** DELETE /rmce/objects/language/{id} */
export async function deleteLanguage(id: string) {
  if (!id) throw new Error('deleteLanguage: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}