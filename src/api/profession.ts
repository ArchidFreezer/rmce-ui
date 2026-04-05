// src/api/profession.ts
import { fetchJson, sendJson } from './client';

import type {
  Profession,
  ProfessionsPayload,
  ProfessionSpellListChoice,
  ProfessionCategoryBonus,
  ProfessionGroupBonus,
  ProfessionSkillDevelopmentType,
  ProfessionCategorySkillDevelopmentType,
  ProfessionGroupSkillDevelopmentType,
  ProfessionSkillSubcategoryDevelopmentTypeChoice,
  ProfessionSkillDevelopmentTypeChoice,
  ProfessionSkillDevelopmentTypeChoiceOption,
  ProfessionCategorySkillDevelopmentTypeChoice,
  ProfessionGroupSkillDevelopmentTypeChoice,
  ProfessionSkillCategoryCost,
  SkillValue,
} from '../types';

const BASE = '/rmce/objects/profession';

const asString = (v: unknown) => String(v ?? '');
const asInt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? '')).filter(Boolean) : [];

function spellListChoiceFromJson(x: any): ProfessionSpellListChoice {
  return {
    numChoices: asInt(x?.['num-choices'] ?? x?.numChoices),
    options: asStringArray(x?.options),
  };
}

function skillBonusFromJson(x: any): SkillValue {
  return {
    id: asString(x?.id),
    subcategory: x?.subcategory != null ? asString(x?.subcategory) : undefined,
    value: asInt(x?.value),
  };
}

function categoryBonusFromJson(x: any): ProfessionCategoryBonus {
  return {
    id: asString(x?.id),
    value: asInt(x?.value),
  };
}

function groupBonusFromJson(x: any): ProfessionGroupBonus {
  return {
    id: asString(x?.id),
    value: asInt(x?.value),
  };
}

function skillDevTypeFromJson(x: any): ProfessionSkillDevelopmentType {
  return {
    id: asString(x?.id),
    subcategory: x?.subcategory != null ? asString(x?.subcategory) : undefined,
    value: asString(x?.value) as ProfessionSkillDevelopmentType['value'],
  };
}

function categorySkillDevTypeFromJson(x: any): ProfessionCategorySkillDevelopmentType {
  return {
    id: asString(x?.id),
    value: asString(x?.value) as ProfessionCategorySkillDevelopmentType['value'],
  };
}

function groupSkillDevTypeFromJson(x: any): ProfessionGroupSkillDevelopmentType {
  return {
    id: asString(x?.id),
    value: asString(x?.value) as ProfessionGroupSkillDevelopmentType['value'],
  };
}

function skillSubcategoryChoiceFromJson(x: any): ProfessionSkillSubcategoryDevelopmentTypeChoice {
  return {
    numChoices: asInt(x?.['num-choices'] ?? x?.numChoices),
    type: asString(x?.type) as ProfessionSkillSubcategoryDevelopmentTypeChoice['type'],
    options: asStringArray(x?.options),
  };
}

function skillDevChoiceOptionFromJson(x: any): ProfessionSkillDevelopmentTypeChoiceOption {
  return {
    id: asString(x?.id),
    subcategory: x?.subcategory != null ? asString(x?.subcategory) : undefined,
  };
}

function skillDevTypeChoiceFromJson(x: any): ProfessionSkillDevelopmentTypeChoice {
  return {
    numChoices: asInt(x?.['num-choices'] ?? x?.numChoices),
    type: asString(x?.type) as ProfessionSkillDevelopmentTypeChoice['type'],
    options: Array.isArray(x?.options) ? x.options.map(skillDevChoiceOptionFromJson) : [],
  };
}

function categoryChoiceFromJson(x: any): ProfessionCategorySkillDevelopmentTypeChoice {
  return {
    numChoices: asInt(x?.['num-choices'] ?? x?.numChoices),
    type: asString(x?.type) as ProfessionCategorySkillDevelopmentTypeChoice['type'],
    options: asStringArray(x?.options),
  };
}

function groupChoiceFromJson(x: any): ProfessionGroupSkillDevelopmentTypeChoice {
  return {
    numChoices: asInt(x?.['num-choices'] ?? x?.numChoices),
    type: asString(x?.type) as ProfessionGroupSkillDevelopmentTypeChoice['type'],
    options: asStringArray(x?.options),
  };
}

function skillCategoryCostFromJson(x: any): ProfessionSkillCategoryCost {
  return {
    category: asString(x?.category),
    cost: asString(x?.cost),
  };
}

function fromJson(x: any): Profession {
  return {
    id: asString(x?.id),
    name: asString(x?.name),
    description: x?.description != null ? asString(x?.description) : undefined,

    book: asString(x?.book),
    allowedRaces: asStringArray(x?.allowedRaces),
    spellUserType: asString(x?.spellUserType) as Profession['spellUserType'],
    realms: asStringArray(x?.realms) as Profession['realms'],
    stats: asStringArray(x?.stats) as Profession['stats'],

    baseSpellListChoices: Array.isArray(x?.baseSpellListChoices)
      ? x.baseSpellListChoices.map(spellListChoiceFromJson)
      : [],

    skillBonuses: Array.isArray(x?.skillBonuses)
      ? x.skillBonuses.map(skillBonusFromJson)
      : [],

    skillCategoryProfessionBonuses: Array.isArray(x?.skillCategoryProfessionBonuses)
      ? x.skillCategoryProfessionBonuses.map(categoryBonusFromJson)
      : [],

    skillCategorySpecialBonuses: Array.isArray(x?.skillCategorySpecialBonuses)
      ? x.skillCategorySpecialBonuses.map(categoryBonusFromJson)
      : [],

    skillGroupProfessionBonuses: Array.isArray(x?.skillGroupProfessionBonuses)
      ? x.skillGroupProfessionBonuses.map(groupBonusFromJson)
      : [],

    skillGroupSpecialBonuses: Array.isArray(x?.skillGroupSpecialBonuses)
      ? x.skillGroupSpecialBonuses.map(groupBonusFromJson)
      : [],

    skillDevelopmentTypes: Array.isArray(x?.skillDevelopmentTypes)
      ? x.skillDevelopmentTypes.map(skillDevTypeFromJson)
      : [],

    skillCategorySkillDevelopmentTypes: Array.isArray(x?.skillCategorySkillDevelopmentTypes)
      ? x.skillCategorySkillDevelopmentTypes.map(categorySkillDevTypeFromJson)
      : [],

    skillGroupSkillDevelopmentTypes: Array.isArray(x?.skillGroupSkillDevelopmentTypes)
      ? x.skillGroupSkillDevelopmentTypes.map(groupSkillDevTypeFromJson)
      : [],

    skillSubcategoryDevelopmentTypeChoices: Array.isArray(x?.skillSubcategoryDevelopmentTypeChoices)
      ? x.skillSubcategoryDevelopmentTypeChoices.map(skillSubcategoryChoiceFromJson)
      : [],

    skillDevelopmentTypeChoices: Array.isArray(x?.skillDevelopmentTypeChoices)
      ? x.skillDevelopmentTypeChoices.map(skillDevTypeChoiceFromJson)
      : [],

    skillCategorySkillDevelopmentTypeChoices: Array.isArray(x?.skillCategorySkillDevelopmentTypeChoices)
      ? x.skillCategorySkillDevelopmentTypeChoices.map(categoryChoiceFromJson)
      : [],

    skillGroupSkillDevelopmentTypeChoices: Array.isArray(x?.skillGroupSkillDevelopmentTypeChoices)
      ? x.skillGroupSkillDevelopmentTypeChoices.map(groupChoiceFromJson)
      : [],

    skillCategoryCosts: Array.isArray(x?.skillCategoryCosts)
      ? x.skillCategoryCosts.map(skillCategoryCostFromJson)
      : [],
  };
}

export async function fetchProfessions(): Promise<Profession[]> {
  const data = await fetchJson<ProfessionsPayload>(BASE);
  if (!data || !Array.isArray((data as any).professions)) {
    throw new Error('Unexpected response: expected { professions: [...] }');
  }
  return (data as ProfessionsPayload).professions.map(fromJson);
}

export async function upsertProfession(
  p: Profession,
  opts: { method?: 'POST' | 'PUT' } = {},
) {
  const { method = 'POST' } = opts;
  const url = BASE;
  return sendJson(url, method, p);
}

export async function deleteProfession(id: string) {
  if (!id) throw new Error('deleteProfession: id is required');
  await fetchJson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}