// src/api/culture.ts
import { fetchJson, sendJson } from './client';

import type { Culture, CulturesPayload } from '../types';

const BASE = '/rmce/data/culture';

const asString = (v: unknown) => String(v ?? '');
const asFloat = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? '')).filter(Boolean) : [];

function backgroundLanguageFromJson(x: any): Culture['backgroundLanguages'][number] {
  const out: Culture['backgroundLanguages'][number] = {
    language: asString(x?.language),
  };
  if (x?.spoken != null) out.spoken = asFloat(x.spoken);
  if (x?.written != null) out.written = asFloat(x.written);
  if (x?.somatic != null) out.somatic = asFloat(x.somatic);
  return out;
}

function hobbySkillFromJson(x: any): Culture['hobbySkills'][number] {
  const out: Culture['hobbySkills'][number] = {
    id: asString(x?.id),
  };
  if (x?.subcategory != null) out.subcategory = asString(x.subcategory);
  return out;
}

function trainingPackageModifierFromJson(x: any): Culture['trainingPackageModifiers'][number] {
  return {
    id: asString(x?.id),
    value: asFloat(x?.value),
  };
}

function fromJson(x: any): Culture {
  return {
    id: asString(x?.id),
    name: asString(x?.name),
    description: x?.description != null ? asString(x.description) : undefined,

    cultureType: asString(x?.cultureType),
    highCulture: asBool(x?.highCulture),

    backgroundLanguages: Array.isArray(x?.backgroundLanguages)
      ? x.backgroundLanguages.map(backgroundLanguageFromJson)
      : [],

    hobbySkills: Array.isArray(x?.hobbySkills)
      ? x.hobbySkills.map(hobbySkillFromJson)
      : [],
    hobbyCategories: asStringArray(x?.hobbyCategories),

    preferredProfessions: asStringArray(x?.preferredProfessions),
    restrictedProfessions: asStringArray(x?.restrictedProfessions),

    trainingPackageModifiers: Array.isArray(x?.trainingPackageModifiers)
      ? x.trainingPackageModifiers.map(trainingPackageModifierFromJson)
      : [],
  };
}

// ---------- API surface ----------

export async function fetchCultures(): Promise<Culture[]> {
  const data = await fetchJson<CulturesPayload>(BASE);
  if (!data || !Array.isArray((data as any).cultures)) {
    throw new Error('Unexpected response: expected { cultures: [...] }');
  }
  return (data as any).cultures.map(fromJson);
}

export async function upsertCulture(
  culture: Culture,
  opts: { method?: 'POST' | 'PUT' } = {},
) {
  const { method = 'POST' } = opts;
  const url = BASE;
  return sendJson(url, method, culture);
}

export async function deleteCulture(id: string) {
  if (!id) throw new Error('deleteCulture: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
