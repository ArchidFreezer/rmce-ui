import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import {
  applyApprenticeshipChoices,
  fetchCultureTypes,
  fetchCultures,
  fetchLanguages,
  fetchProfessions,
  fetchRaces,
  fetchSkillCategories,
  fetchSkillGroups,
  fetchSkills,
  fetchSpellLists,
  fetchTrainingPackages,
  fetchWeaponTypes,
  getStatRollPotentials,
  setCharacterStats,
  setCharacterPhysique,
  setCharacterBackgroundChoices,
  setCharacterHobbyChoices,
  setCharacterPrimaryChoices,
  setPrimaryDefinition,
  type SetCharacterBackgroundChoicesRequest,
} from '../../api';

import {
  CheckboxInput,
  LabeledInput,
  LabeledSelect,
  RichOptionLabel,
  RichSelect,
  type RichSelectOption,
  Spinner,
  useToast,
} from '../../components';

import { createEmptyCharacterBuilder } from '../../types';

import type {
  CharacterBuilder,
  Culture,
  CultureType,
  Profession,
  Race,
  Language,
  Skill,
  SkillCategory,
  SkillGroup,
  SpellList,
  TrainingPackage,
  WeaponType,
} from '../../types';

import { DEVELOPMENT_STATS, SPELL_REALMS, STATS, getStatForRealm, type Realm, type SkillDevelopmentType, type Stat } from '../../types/enum';
import { isValidUnsignedInt, sanitizeUnsignedInt } from '../../utils';

type CharacterStep =
  | 'primary'
  | 'initial'
  | 'stats'
  | 'physique'
  | 'hobby'
  | 'background'
  | 'apprenticeship'
  | 'summary';

const STEP_ORDER: CharacterStep[] = [
  'primary',
  'initial',
  'stats',
  'physique',
  'hobby',
  'background',
  'apprenticeship',
  'summary',
];

const STEP_LABELS: Record<CharacterStep, string> = {
  primary: '1. Primary Definition',
  initial: '2. Initial Choices',
  stats: '3. Stat Generation',
  physique: '4. Physique',
  hobby: '5. Hobby Ranks',
  background: '6. Background Options',
  apprenticeship: '7. Apprenticeship Skills',
  summary: '8. Summary',
};

const OWN_REALM_OPEN_LISTS_CATEGORY_ID = 'SKILLCATEGORY_SPELLS_OWN_REALM_OPEN_LISTS';
const OWN_REALM_CLOSED_LISTS_CATEGORY_ID = 'SKILLCATEGORY_SPELLS_OWN_REALM_CLOSED_LISTS';
const PURE_EXTRA_SPELL_LIST_COUNT = 4;

type StepErrors = {
  primary?: string | undefined;
  initial?: string | undefined;
  stats?: string | undefined;
  physique?: string | undefined;
  hobby?: string | undefined;
  background?: string | undefined;
  apprenticeship?: string | undefined;
  summary?: string | undefined;
};

type HobbySkillRow = {
  id: string;
  subcategory?: string | undefined;
  subcategoryLocked: boolean;
  base: number;
  max: number;
  value: number;
};

type HobbyCategoryRow = {
  id: string;
  base: number;
  max: number;
  value: number;
};

type HobbyLanguageRow = {
  language: string;
  baseSpoken: number;
  baseWritten: number;
  baseSomatic: number;
  maxSpoken: number;
  maxWritten: number;
  maxSomatic: number;
  spoken: number;
  written: number;
  somatic: number;
};

type BackgroundLanguageRow = {
  language: string;
  baseSpoken: number;
  baseWritten: number;
  baseSomatic: number;
  maxSpoken: number;
  maxWritten: number;
  maxSomatic: number;
  spoken: number;
  written: number;
  somatic: number;
};

type BackgroundSkillBonusRow = {
  id: string;
  subcategory: string;
};

type BackgroundOptionState = {
  extraStatGainRolls: boolean;
  extraMoneyPoints: number;
  extraLanguages: boolean;
  languageRows: BackgroundLanguageRow[];
  skillBonuses: BackgroundSkillBonusRow[];
  categoryBonusIds: string[];
  specialItemsPoints: number;
};

type ApprenticeSkillPurchase = {
  id: string;
  subcategory: string;
  purchases: number;
};

type ApprenticeCategoryPurchase = {
  id: string;
  purchases: number;
};

type ApprenticeSpellListPurchase = {
  id: string;
  purchases: number;
};

type TpSkillAllocation = { id: string; subcategory: string; ranks: number };
type TpSpellListAllocation = { id: string; ranks: number };
type TpGroupCategoryAndSkillChoice = { categoryId: string; skillId: string; subcategory: string };
type TpLanguageAllocation = { languageId: string; spoken: number; written: number; somatic: number };

type TpResolution = {
  tpId: string;
  statGainChoices: (Stat | '')[];
  skillRankChoices: TpSkillAllocation[][];
  categoryMultiSkillChoices: TpSkillAllocation[][];
  groupMultiSkillChoices: TpSkillAllocation[][];
  groupCategoryAndSkillChoices: TpGroupCategoryAndSkillChoice[];
  spellListChoices: TpSpellListAllocation[][];
  spellListCategoryChoices: TpSpellListAllocation[][];
  lifestyleCategorySkillChoices: string[][];
  languageChoices: TpLanguageAllocation[][];
};

type ApprenticeSubstep = 'selecting' | 'resolving' | 'purchasing';

type StatRoll = {
  slot: number;
  temporary: string;
  potential: number | null;
  assignedStat: Stat | '';
};

type SkillChoiceRow = {
  id: string;
  subcategory: string;
};

function createEmptyStatRolls(): StatRoll[] {
  return STATS.map((_, index) => ({
    slot: index + 1,
    temporary: '',
    potential: null,
    assignedStat: '',
  }));
}

function randomD100(): number {
  return Math.floor(Math.random() * 100) + 1;
}

function rollTemporaryValue(): number {
  let value = randomD100();
  while (value < 25) {
    value = randomD100();
  }
  return value;
}

function sortRollsDescending(rolls: StatRoll[]): StatRoll[] {
  return [...rolls].sort((a, b) => {
    const aValue = Number(a.temporary);
    const bValue = Number(b.temporary);
    const aIsValid = Number.isFinite(aValue);
    const bIsValid = Number.isFinite(bValue);

    if (!aIsValid && !bIsValid) return a.slot - b.slot;
    if (!aIsValid) return 1;
    if (!bIsValid) return -1;
    return bValue - aValue || a.slot - b.slot;
  });
}

function uniqStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function skillChoiceKey(id: string, subcategory?: string | undefined): string {
  return subcategory?.trim() ? `${id}::${subcategory.trim()}` : id;
}

function createEmptySkillChoiceRow(): SkillChoiceRow {
  return {
    id: '',
    subcategory: '',
  };
}

function createBackgroundLanguageRows(
  culture: Culture | undefined,
  languageAbilities: CharacterBuilder['languageAbilities'] = [],
): BackgroundLanguageRow[] {
  const abilityByLanguage = new Map<string, { spoken: number; written: number; somatic: number }>();
  for (const row of languageAbilities ?? []) {
    abilityByLanguage.set(row.language, {
      spoken: Math.max(0, row.spoken ?? 0),
      written: Math.max(0, row.written ?? 0),
      somatic: Math.max(0, row.somatic ?? 0),
    });
  }

  return (culture?.backgroundLanguages ?? []).map((row) => {
    const maxSpoken = Math.max(0, row.spoken ?? 0);
    const maxWritten = Math.max(0, row.written ?? 0);
    const maxSomatic = Math.max(0, row.somatic ?? 0);
    const existing = abilityByLanguage.get(row.language);

    return {
      language: row.language,
      baseSpoken: Math.min(existing?.spoken ?? 0, maxSpoken),
      baseWritten: Math.min(existing?.written ?? 0, maxWritten),
      baseSomatic: Math.min(existing?.somatic ?? 0, maxSomatic),
      maxSpoken,
      maxWritten,
      maxSomatic,
      spoken: Math.min(existing?.spoken ?? 0, maxSpoken),
      written: Math.min(existing?.written ?? 0, maxWritten),
      somatic: Math.min(existing?.somatic ?? 0, maxSomatic),
    };
  });
}

function createEmptyBackgroundOptionState(): BackgroundOptionState {
  return {
    extraStatGainRolls: false,
    extraMoneyPoints: 0,
    extraLanguages: false,
    languageRows: [],
    skillBonuses: [],
    categoryBonusIds: [],
    specialItemsPoints: 0,
  };
}

function getBackgroundLanguageRankSpent(rows: BackgroundLanguageRow[]): number {
  return rows.reduce(
    (sum, row) => sum
      + Math.max(0, row.spoken - row.baseSpoken)
      + Math.max(0, row.written - row.baseWritten)
      + Math.max(0, row.somatic - row.baseSomatic),
    0,
  );
}

function getSelectedBackgroundPoints(state: BackgroundOptionState): number {
  return (state.extraStatGainRolls ? 1 : 0)
    + state.extraMoneyPoints
    + (state.extraLanguages ? 1 : 0)
    + state.skillBonuses.length
    + state.categoryBonusIds.length
    + state.specialItemsPoints;
}

function getSelectedBackgroundOptionsPayload(state: BackgroundOptionState): string[] {
  const out: string[] = [];
  if (state.extraStatGainRolls) out.push('EXTRA_STAT_GAIN_ROLLS');
  for (let i = 0; i < state.extraMoneyPoints; i++) out.push('EXTRA_MONEY');
  if (state.extraLanguages) out.push('EXTRA_LANGUAGES');
  for (const row of state.skillBonuses) out.push(`SKILL_BONUS:${row.id}`);
  for (const id of state.categoryBonusIds) out.push(`SKILL_CATEGORY_BONUS:${id}`);
  for (let i = 0; i < state.specialItemsPoints; i++) out.push('SPECIAL_ITEMS');
  return out;
}

const STAT_GAIN_DP_COST = 8;

function parseCostString(cost: string): number[] {
  if (!cost) return [];
  return cost.split(':').map(Number).filter((n) => !isNaN(n) && n >= 0);
}

function getMaxPurchases(costElements: number[]): number {
  return costElements.length;
}

function getSkillMaxPurchases(costElements: number[], devType: SkillDevelopmentType | undefined): number {
  if (devType === 'Restricted') return Math.ceil(costElements.length / 2);
  return costElements.length;
}

function getSkillRanksPerPurchase(devType: SkillDevelopmentType | undefined): number {
  switch (devType) {
    case 'Occupational': return 3;
    case 'Everyman': return 2;
    case 'Restricted': return 1;
    case 'Standard':
    default: return 1;
  }
}

function getSkillPurchaseTotalCost(costElements: number[], devType: SkillDevelopmentType | undefined, purchases: number): number {
  if (devType === 'Restricted') {
    let total = 0;
    for (let r = 0; r < purchases; r++) {
      const i1 = r * 2;
      const i2 = r * 2 + 1;
      if (i2 < costElements.length) {
        total += (costElements[i1] ?? 0) + (costElements[i2] ?? 0);
      } else if (i1 < costElements.length) {
        total += (costElements[i1] ?? 0) * 2;
      }
    }
    return total;
  }
  return costElements.slice(0, purchases).reduce((s, c) => s + c, 0);
}

function getCategoryOrSpellListPurchaseTotalCost(costElements: number[], purchases: number): number {
  return costElements.slice(0, purchases).reduce((s, c) => s + c, 0);
}

function tpHasChoices(tp: TrainingPackage): boolean {
  return (
    (tp.statGainChoices?.numChoices ?? 0) > 0
    || (tp.skillRankChoices ?? []).some((c) => c.numChoices > 0)
    || (tp.categoryMultiSkillRankChoices ?? []).some((c) => c.numChoices > 0)
    || (tp.groupMultiSkillRankChoices ?? []).some((c) => c.numChoices > 0)
    || (tp.groupCategoryAndSkillRankChoices ?? []).length > 0
    || (tp.spellListRanks ?? []).some((r) => r.numChoices > 0)
    || (tp.spellListCategoryRankChoices ?? []).some((c) => c.numChoices > 0)
    || (tp.lifestyleCategorySkillChoices ?? []).some((c) => c.numChoices > 0)
    || (tp.languageChoices ?? []).some((c) => c.numChoices > 0)
  );
}

function createEmptyTpResolution(tp: TrainingPackage): TpResolution {
  return {
    tpId: tp.id,
    statGainChoices: Array.from({ length: tp.statGainChoices?.numChoices ?? 0 }, () => '' as Stat | ''),
    skillRankChoices: (tp.skillRankChoices ?? []).map(() => []),
    categoryMultiSkillChoices: (tp.categoryMultiSkillRankChoices ?? []).map(() => []),
    groupMultiSkillChoices: (tp.groupMultiSkillRankChoices ?? []).map(() => []),
    groupCategoryAndSkillChoices: (tp.groupCategoryAndSkillRankChoices ?? []).map(() => ({
      categoryId: '',
      skillId: '',
      subcategory: '',
    })),
    spellListChoices: (tp.spellListRanks ?? [])
      .filter((r) => r.numChoices > 0)
      .map(() => []),
    spellListCategoryChoices: (tp.spellListCategoryRankChoices ?? []).map(() => []),
    lifestyleCategorySkillChoices: (tp.lifestyleCategorySkillChoices ?? []).map((c) =>
      Array.from({ length: c.numChoices }, () => ''),
    ),
    languageChoices: (tp.languageChoices ?? []).map(() => []),
  };
}

function validateTpResolution(tp: TrainingPackage, resolution: TpResolution, excludedStats: ReadonlySet<Stat> = new Set()): string | undefined {
  if (tp.statGainChoices && tp.statGainChoices.numChoices > 0) {
    for (let i = 0; i < tp.statGainChoices.numChoices; i++) {
      if (!resolution.statGainChoices[i]) return `${tp.name}: select stat for gain choice ${i + 1}.`;
      if (excludedStats.has(resolution.statGainChoices[i] as Stat)) {
        return `${tp.name}: stat gain choice ${i + 1} is already claimed by a realm stat gain.`;
      }
    }
    const chosen = resolution.statGainChoices.filter(Boolean);
    if (new Set(chosen).size < chosen.length) return `${tp.name}: stat gain choices must be unique.`;
  }

  for (let gi = 0; gi < (tp.skillRankChoices ?? []).length; gi++) {
    const choiceDef = (tp.skillRankChoices ?? [])[gi];
    if (!choiceDef || choiceDef.numChoices <= 0) continue;
    const allocs = resolution.skillRankChoices[gi] ?? [];
    const totalRanks = allocs.reduce((s, a) => s + a.ranks, 0);
    if (totalRanks !== choiceDef.value) {
      const remaining = choiceDef.value - totalRanks;
      return `${tp.name}: skill rank choice ${gi + 1}: ${remaining > 0 ? `${remaining} rank${remaining !== 1 ? 's' : ''} still to allocate` : 'too many ranks allocated'}.`;
    }
    if (allocs.length > choiceDef.numChoices) return `${tp.name}: skill rank choice ${gi + 1}: at most ${choiceDef.numChoices} skill${choiceDef.numChoices !== 1 ? 's' : ''} allowed.`;
    for (const alloc of allocs) {
      if (!alloc.id) return `${tp.name}: skill rank choice ${gi + 1}: all allocations must have a skill selected.`;
      if (alloc.ranks < 1) return `${tp.name}: skill rank choice ${gi + 1}: each allocation must have at least 1 rank.`;
    }
    const ids = allocs.map((a) => a.id);
    if (new Set(ids).size < ids.length) return `${tp.name}: skill rank choice ${gi + 1}: duplicate skills selected.`;
  }

  for (let gi = 0; gi < (tp.categoryMultiSkillRankChoices ?? []).length; gi++) {
    const choiceDef = (tp.categoryMultiSkillRankChoices ?? [])[gi];
    if (!choiceDef || choiceDef.numChoices <= 0) continue;
    const allocs = resolution.categoryMultiSkillChoices[gi] ?? [];
    const totalRanks = allocs.reduce((s, a) => s + a.ranks, 0);
    if (totalRanks !== choiceDef.value) {
      const remaining = choiceDef.value - totalRanks;
      return `${tp.name}: category skill choice ${gi + 1}: ${remaining > 0 ? `${remaining} rank${remaining !== 1 ? 's' : ''} still to allocate` : 'too many ranks allocated'}.`;
    }
    if (allocs.length > choiceDef.numChoices) return `${tp.name}: category skill choice ${gi + 1}: at most ${choiceDef.numChoices} skill${choiceDef.numChoices !== 1 ? 's' : ''} allowed.`;
    for (const alloc of allocs) {
      if (!alloc.id) return `${tp.name}: category skill choice ${gi + 1}: all allocations must have a skill selected.`;
      if (alloc.ranks < 1) return `${tp.name}: category skill choice ${gi + 1}: each allocation must have at least 1 rank.`;
    }
    const ids = allocs.map((a) => a.id);
    if (new Set(ids).size < ids.length) return `${tp.name}: category skill choice ${gi + 1}: duplicate skills selected.`;
  }

  for (let gi = 0; gi < (tp.groupMultiSkillRankChoices ?? []).length; gi++) {
    const choiceDef = (tp.groupMultiSkillRankChoices ?? [])[gi];
    if (!choiceDef || choiceDef.numChoices <= 0) continue;
    const allocs = resolution.groupMultiSkillChoices[gi] ?? [];
    const totalRanks = allocs.reduce((s, a) => s + a.ranks, 0);
    if (totalRanks !== choiceDef.value) {
      const remaining = choiceDef.value - totalRanks;
      return `${tp.name}: group skill choice ${gi + 1}: ${remaining > 0 ? `${remaining} rank${remaining !== 1 ? 's' : ''} still to allocate` : 'too many ranks allocated'}.`;
    }
    if (allocs.length > choiceDef.numChoices) return `${tp.name}: group skill choice ${gi + 1}: at most ${choiceDef.numChoices} skill${choiceDef.numChoices !== 1 ? 's' : ''} allowed.`;
    for (const alloc of allocs) {
      if (!alloc.id) return `${tp.name}: group skill choice ${gi + 1}: all allocations must have a skill selected.`;
      if (alloc.ranks < 1) return `${tp.name}: group skill choice ${gi + 1}: each allocation must have at least 1 rank.`;
    }
    const ids = allocs.map((a) => a.id);
    if (new Set(ids).size < ids.length) return `${tp.name}: group skill choice ${gi + 1}: duplicate skills selected.`;
  }

  for (let gi = 0; gi < (tp.groupCategoryAndSkillRankChoices ?? []).length; gi++) {
    const slot = resolution.groupCategoryAndSkillChoices[gi];
    if (!slot || !slot.categoryId) return `${tp.name}: group category & skill choice ${gi + 1}: select a category.`;
    if (!slot.skillId) return `${tp.name}: group category & skill choice ${gi + 1}: select a skill.`;
  }

  const choiceableSlRanks = (tp.spellListRanks ?? []).filter((r) => r.numChoices > 0);
  for (let gi = 0; gi < choiceableSlRanks.length; gi++) {
    const choiceDef = choiceableSlRanks[gi];
    if (!choiceDef) continue;
    const allocs = resolution.spellListChoices[gi] ?? [];
    const totalRanks = allocs.reduce((s, a) => s + a.ranks, 0);
    if (totalRanks !== choiceDef.value) {
      const remaining = choiceDef.value - totalRanks;
      return `${tp.name}: spell list choice ${gi + 1}: ${remaining > 0 ? `${remaining} rank${remaining !== 1 ? 's' : ''} still to allocate` : 'too many ranks allocated'}.`;
    }
    if (allocs.length > choiceDef.numChoices) return `${tp.name}: spell list choice ${gi + 1}: at most ${choiceDef.numChoices} spell list${choiceDef.numChoices !== 1 ? 's' : ''} allowed.`;
    for (const alloc of allocs) {
      if (!alloc.id) return `${tp.name}: spell list choice ${gi + 1}: all allocations must have a spell list selected.`;
      if (alloc.ranks < 1) return `${tp.name}: spell list choice ${gi + 1}: each allocation must have at least 1 rank.`;
    }
    const ids = allocs.map((a) => a.id);
    if (new Set(ids).size < ids.length) return `${tp.name}: spell list choice ${gi + 1}: duplicate spell lists selected.`;
  }

  for (let gi = 0; gi < (tp.spellListCategoryRankChoices ?? []).length; gi++) {
    const choiceDef = (tp.spellListCategoryRankChoices ?? [])[gi];
    if (!choiceDef || choiceDef.numChoices <= 0) continue;
    const allocs = resolution.spellListCategoryChoices[gi] ?? [];
    const totalRanks = allocs.reduce((s, a) => s + a.ranks, 0);
    if (totalRanks !== choiceDef.value) {
      const remaining = choiceDef.value - totalRanks;
      return `${tp.name}: spell list category choice ${gi + 1}: ${remaining > 0 ? `${remaining} rank${remaining !== 1 ? 's' : ''} still to allocate` : 'too many ranks allocated'}.`;
    }
    if (allocs.length > choiceDef.numChoices) return `${tp.name}: spell list category choice ${gi + 1}: at most ${choiceDef.numChoices} spell list${choiceDef.numChoices !== 1 ? 's' : ''} allowed.`;
    for (const alloc of allocs) {
      if (!alloc.id) return `${tp.name}: spell list category choice ${gi + 1}: all allocations must have a spell list selected.`;
      if (alloc.ranks < 1) return `${tp.name}: spell list category choice ${gi + 1}: each allocation must have at least 1 rank.`;
    }
    const ids = allocs.map((a) => a.id);
    if (new Set(ids).size < ids.length) return `${tp.name}: spell list category choice ${gi + 1}: duplicate spell lists selected.`;
  }

  for (let gi = 0; gi < (tp.lifestyleCategorySkillChoices ?? []).length; gi++) {
    const choiceDef = (tp.lifestyleCategorySkillChoices ?? [])[gi];
    if (!choiceDef || choiceDef.numChoices <= 0) continue;
    const chosen = resolution.lifestyleCategorySkillChoices[gi] ?? [];
    for (let si = 0; si < choiceDef.numChoices; si++) {
      if (!chosen[si]) return `${tp.name}: lifestyle skill choice ${gi + 1} slot ${si + 1} required.`;
    }
    const nonEmpty = chosen.filter(Boolean);
    if (new Set(nonEmpty).size < nonEmpty.length) return `${tp.name}: lifestyle skill choice ${gi + 1}: duplicate skills selected.`;
  }

  for (let gi = 0; gi < (tp.languageChoices ?? []).length; gi++) {
    const choiceDef = (tp.languageChoices ?? [])[gi];
    if (!choiceDef || choiceDef.numChoices <= 0) continue;
    const allocs = resolution.languageChoices[gi] ?? [];
    if (allocs.length === 0) return `${tp.name}: language choice ${gi + 1}: at least one language required.`;
    if (allocs.length > choiceDef.numChoices) return `${tp.name}: language choice ${gi + 1}: at most ${choiceDef.numChoices} language${choiceDef.numChoices !== 1 ? 's' : ''} allowed.`;
    for (const alloc of allocs) {
      if (!alloc.languageId) return `${tp.name}: language choice ${gi + 1}: all entries must have a language selected.`;
    }
    const langIds = allocs.map((a) => a.languageId).filter(Boolean);
    if (new Set(langIds).size < langIds.length) return `${tp.name}: language choice ${gi + 1}: duplicate languages selected.`;
    const totalRanks = allocs.reduce((s, a) => s + a.spoken + a.written + a.somatic, 0);
    if (totalRanks !== choiceDef.value) {
      const remaining = choiceDef.value - totalRanks;
      return `${tp.name}: language choice ${gi + 1}: ${remaining > 0 ? `${remaining} rank${remaining !== 1 ? 's' : ''} still to allocate` : `${Math.abs(remaining)} rank${Math.abs(remaining) !== 1 ? 's' : ''} over`}.`;
    }
  }
  return undefined;
}

function getSkillMaxDpPurchases(
  costElements: number[],
  devType: SkillDevelopmentType | undefined,
  tpRanks: number,
): number {
  if (devType === 'Restricted') {
    return Math.max(0, Math.floor((costElements.length - tpRanks * 2) / 2));
  }
  const ranksPerPurchase = getSkillRanksPerPurchase(devType);
  const usedPurchases = Math.ceil(tpRanks / (ranksPerPurchase || 1));
  return Math.max(0, costElements.length - usedPurchases);
}

function getSkillDpCostWithTpOffset(
  costElements: number[],
  devType: SkillDevelopmentType | undefined,
  purchases: number,
  tpRanks: number,
): number {
  if (purchases <= 0) return 0;
  if (devType === 'Restricted') {
    let total = 0;
    for (let r = 0; r < purchases; r++) {
      const i1 = (tpRanks + r) * 2;
      const i2 = (tpRanks + r) * 2 + 1;
      total += (costElements[i1] ?? 0) + (costElements[i2] ?? 0);
    }
    return total;
  }
  const ranksPerPurchase = getSkillRanksPerPurchase(devType);
  const purchaseOffset = Math.ceil(tpRanks / (ranksPerPurchase || 1));
  return costElements.slice(purchaseOffset, purchaseOffset + purchases).reduce((s, c) => s + c, 0);
}

function getCategoryMaxDpPurchases(costElements: number[], tpRanks: number): number {
  return Math.max(0, costElements.length - tpRanks);
}

function getCategoryDpCostWithTpOffset(costElements: number[], purchases: number, tpRanks: number): number {
  if (purchases <= 0) return 0;
  return costElements.slice(tpRanks, tpRanks + purchases).reduce((s, c) => s + c, 0);
}

function getBuildLabel(modifier: number): string {
  if (modifier <= -10) return 'Skeletal';
  if (modifier <= -7) return 'Wasted';
  if (modifier <= -4) return 'Thin';
  if (modifier <= -2) return 'Slender';
  if (modifier <= 1) return 'Normal';
  if (modifier <= 4) return 'Stocky';
  if (modifier <= 7) return 'Large';
  if (modifier <= 10) return 'Obese';
  return 'Blubbery';
}

export default function CharacterCreationView() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [races, setRaces] = useState<Race[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [cultureTypes, setCultureTypes] = useState<CultureType[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [groups, setGroups] = useState<SkillGroup[]>([]);
  const [spellLists, setSpellLists] = useState<SpellList[]>([]);
  const [trainingPackages, setTrainingPackages] = useState<TrainingPackage[]>([]);
  const [weaponTypes, setWeaponTypes] = useState<WeaponType[]>([]);

  const [step, setStep] = useState<CharacterStep>('primary');
  const [errors, setErrors] = useState<StepErrors>({});

  const [raceId, setRaceId] = useState('');
  const [cultureTypeId, setCultureTypeId] = useState('');
  const [cultureId, setCultureId] = useState('');
  const [professionId, setProfessionId] = useState('');
  const [showDescriptions, setShowDescriptions] = useState(false);
  const [selectedRealms, setSelectedRealms] = useState<Realm[]>([]);

  const [raceEverymanChoiceRows, setRaceEverymanChoiceRows] = useState<SkillChoiceRow[][]>([]);
  const [cultureTypeCategorySkillRankRows, setCultureTypeCategorySkillRankRows] = useState<SkillChoiceRow[]>([]);
  const [professionSkillDevelopmentChoiceRows, setProfessionSkillDevelopmentChoiceRows] = useState<SkillChoiceRow[][]>([]);
  const [professionCategoryDevelopmentChoiceRows, setProfessionCategoryDevelopmentChoiceRows] = useState<SkillChoiceRow[][]>([]);
  const [professionGroupDevelopmentChoiceRows, setProfessionGroupDevelopmentChoiceRows] = useState<SkillChoiceRow[][]>([]);
  const [professionBaseSpellListChoiceRows, setProfessionBaseSpellListChoiceRows] = useState<string[][]>([]);
  const [professionWeaponCategoryCostSelections, setProfessionWeaponCategoryCostSelections] = useState<string[]>([]);

  const [statRolls, setStatRolls] = useState<StatRoll[]>(() => createEmptyStatRolls());
  const [statRollsLocked, setStatRollsLocked] = useState(false);
  const [generatingStats, setGeneratingStats] = useState(false);

  const [characterName, setCharacterName] = useState('');

  const [isMale, setIsMale] = useState(true);
  const [physiqueAutoHeight, setPhysiqueAutoHeight] = useState(true);
  const [physiqueEnteredHeightStr, setPhysiqueEnteredHeightStr] = useState('');
  const [physiqueAutoBuildMod, setPhysiqueAutoBuildMod] = useState(true);
  const [physiqueEnteredBuildMod, setPhysiqueEnteredBuildMod] = useState(0);
  const [savingPhysique, setSavingPhysique] = useState(false);

  const [hobbyRanksBudget, setHobbyRanksBudget] = useState(0);
  const [hobbySkillRows, setHobbySkillRows] = useState<HobbySkillRow[]>([]);
  const [hobbyCategoryRows, setHobbyCategoryRows] = useState<HobbyCategoryRow[]>([]);

  const [languageRanksBudget, setLanguageRanksBudget] = useState(0);
  const [hobbyLanguageRows, setHobbyLanguageRows] = useState<HobbyLanguageRow[]>([]);

  const [spellListRanksBudget, setSpellListRanksBudget] = useState(0);
  const [hobbySpellListOptions, setHobbySpellListOptions] = useState<string[]>([]);
  const [hobbySpellListId, setHobbySpellListId] = useState('');

  const [backgroundExtraStatGainRolls, setBackgroundExtraStatGainRolls] = useState(false);
  const [backgroundExtraMoneyPoints, setBackgroundExtraMoneyPoints] = useState(0);
  const [backgroundExtraLanguages, setBackgroundExtraLanguages] = useState(false);
  const [backgroundLanguageRows, setBackgroundLanguageRows] = useState<BackgroundLanguageRow[]>([]);
  const [backgroundSkillBonusRows, setBackgroundSkillBonusRows] = useState<BackgroundSkillBonusRow[]>([]);
  const [backgroundSkillCategoryFilter, setBackgroundSkillCategoryFilter] = useState('');
  const [backgroundSkillPendingId, setBackgroundSkillPendingId] = useState('');
  const [backgroundSkillPendingSubcategory, setBackgroundSkillPendingSubcategory] = useState('');
  const [backgroundCategoryBonusIds, setBackgroundCategoryBonusIds] = useState<string[]>([]);
  const [backgroundSpecialItemsPoints, setBackgroundSpecialItemsPoints] = useState(0);

  const [apprenticeTrainingPackageIds, setApprenticeTrainingPackageIds] = useState<string[]>([]);
  const [apprenticeStatGains, setApprenticeStatGains] = useState<Stat[]>([]);
  const [apprenticeSkillPurchases, setApprenticeSkillPurchases] = useState<ApprenticeSkillPurchase[]>([]);
  const [apprenticeSkillCategoryFilter, setApprenticeSkillCategoryFilter] = useState('');
  const [apprenticeSkillPendingId, setApprenticeSkillPendingId] = useState('');
  const [apprenticeSkillPendingSubcategory, setApprenticeSkillPendingSubcategory] = useState('');
  const [apprenticeCategoryPurchases, setApprenticeCategoryPurchases] = useState<ApprenticeCategoryPurchase[]>([]);
  const [apprenticeSpellListPurchases, setApprenticeSpellListPurchases] = useState<ApprenticeSpellListPurchase[]>([]);
  const [apprenticeSelectedSpellCategory, setApprenticeSelectedSpellCategory] = useState('');
  const [apprenticeAddingSpellList, setApprenticeAddingSpellList] = useState(false);
  const [apprenticeSubstep, setApprenticeSubstep] = useState<ApprenticeSubstep>('selecting');
  const [apprenticeResolvingTpIndex, setApprenticeResolvingTpIndex] = useState(0);
  const [tpResolutions, setTpResolutions] = useState<TpResolution[]>([]);
  const [preApprenticeshipRanks, setPreApprenticeshipRanks] = useState<{
    skillRanks: CharacterBuilder['skillRanks'];
    categoryRanks: CharacterBuilder['categoryRanks'];
    spellListRanks: CharacterBuilder['spellListRanks'];
  }>({ skillRanks: [], categoryRanks: [], spellListRanks: [] });
  const [characterBuilder, setCharacterBuilder] = useState<CharacterBuilder>(() => createEmptyCharacterBuilder());
  const [savingPrimaryDefinition, setSavingPrimaryDefinition] = useState(false);
  const [savingInitialChoices, setSavingInitialChoices] = useState(false);
  const [savingStats, setSavingStats] = useState(false);
  const [savingHobbyChoices, setSavingHobbyChoices] = useState(false);
  const [savingBackgroundChoices, setSavingBackgroundChoices] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [raceData, languageData, cultureTypeData, cultureData, professionData, skillData, categoryData, groupData, spellListData, tpData, weaponTypeData] = await Promise.all([
          fetchRaces(),
          fetchLanguages(),
          fetchCultureTypes(),
          fetchCultures(),
          fetchProfessions(),
          fetchSkills(),
          fetchSkillCategories(),
          fetchSkillGroups(),
          fetchSpellLists(),
          fetchTrainingPackages(),
          fetchWeaponTypes(),
        ]);

        setRaces(raceData);
        setLanguages(languageData);
        setCultureTypes(cultureTypeData);
        setCultures(cultureData);
        setProfessions(professionData);
        setSkills(skillData);
        setCategories(categoryData);
        setGroups(groupData);
        setSpellLists(spellListData);
        setTrainingPackages(tpData);
        setWeaponTypes(weaponTypeData);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const race = useMemo(
    () => races.find((x) => x.id === raceId),
    [races, raceId],
  );

  const culture = useMemo(
    () => cultures.find((x) => x.id === cultureId),
    [cultures, cultureId],
  );

  const cultureType = useMemo(
    () => cultureTypes.find((x) => x.id === cultureTypeId),
    [cultureTypes, cultureTypeId],
  );

  const availableCultures = useMemo(
    () => cultures.filter((x) => x.cultureType === cultureTypeId),
    [cultures, cultureTypeId],
  );

  const profession = useMemo(
    () => professions.find((x) => x.id === professionId),
    [professions, professionId],
  );

  const skillNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of skills) map.set(s.id, s.name);
    return map;
  }, [skills]);

  const mandatorySubcategorySkillIds = useMemo(
    () => new Set(skills.filter((s) => s.mandatorySubcategory).map((s) => s.id)),
    [skills],
  );

  const skillIdsByCategory = useMemo(() => {
    const map = new Map<string, Skill[]>();
    for (const s of skills) {
      const existing = map.get(s.category) ?? [];
      existing.push(s);
      map.set(s.category, existing);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [skills]);

  const categoryIdsByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const category of categories) {
      const existing = map.get(category.group) ?? [];
      existing.push(category.id);
      map.set(category.group, existing);
    }
    return map;
  }, [categories]);

  const raceEverymanChoiceDefinitions = useMemo(
    () => race?.skillCategoryChoicesEveryman ?? [],
    [race],
  );

  const cultureTypeCategorySkillRankDefinitions = useMemo(
    () => cultureType?.skillCategorySkillRanks ?? [],
    [cultureType],
  );

  const professionSkillDevelopmentChoiceDefinitions = useMemo(
    () => profession?.skillDevelopmentTypeChoices ?? [],
    [profession],
  );

  const professionCategoryDevelopmentChoiceDefinitions = useMemo(
    () => profession?.skillCategorySkillDevelopmentTypeChoices ?? [],
    [profession],
  );

  const professionGroupDevelopmentChoiceDefinitions = useMemo(
    () => profession?.skillGroupSkillDevelopmentTypeChoices ?? [],
    [profession],
  );

  const professionBaseSpellListChoiceDefinitions = useMemo(
    () => (profession?.baseSpellListChoices ?? []).filter((choice) => choice.numChoices < choice.options.length),
    [profession],
  );

  const professionWeaponCategoryCostDefinitions = useMemo(() => {
    const out: Array<{ cost: string; defaultCategory: string }> = [];
    const costs = profession?.skillCategoryCosts ?? [];
    for (const row of costs) {
      const category = categories.find((c) => c.id === row.category);
      if (!category) continue;
      if (category.group !== 'SKILLGROUP_WEAPON') continue;
      out.push({
        cost: row.cost,
        defaultCategory: row.category,
      });
    }
    return out;
  }, [profession, categories]);

  const weaponSkillCategoryOptions = useMemo(
    () => categories
      .filter((c) => c.group === 'SKILLGROUP_WEAPON')
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );

  const fixedProfessionBaseSpellLists = useMemo(
    () => (profession?.baseSpellListChoices ?? [])
      .filter((choice) => choice.numChoices >= choice.options.length)
      .flatMap((choice) => choice.options.slice(0, choice.numChoices)),
    [profession],
  );

  const categoryNameById = useMemo(() => {
    const groupNameById = new Map<string, string>();
    for (const g of groups) groupNameById.set(g.id, g.name);

    const map = new Map<string, string>();
    for (const c of categories) {
      const groupName = groupNameById.get(c.group) ?? c.group;
      map.set(c.id, `(${groupName}) - ${c.name}`);
    }
    return map;
  }, [categories, groups]);

  const categoryGroupNameById = useMemo(() => {
    const groupNameById = new Map<string, string>();
    for (const g of groups) groupNameById.set(g.id, g.name);
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.id, groupNameById.get(c.group) ?? c.group);
    return map;
  }, [categories, groups]);

  const languageNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of languages) map.set(l.id, l.name);
    return map;
  }, [languages]);

  const languageById = useMemo(() => {
    const map = new Map<string, Language>();
    for (const l of languages) map.set(l.id, l);
    return map;
  }, [languages]);

  const weaponTypeOptionsBySkillId = useMemo(() => {
    const map = new Map<string, Array<{ value: string; label: string }>>();
    for (const row of weaponTypes) {
      const existing = map.get(row.skill) ?? [];
      existing.push({ value: row.id, label: row.name });
      map.set(row.skill, existing);
    }

    for (const rows of map.values()) {
      rows.sort((a, b) => a.label.localeCompare(b.label));
    }

    return map;
  }, [weaponTypes]);

  const weaponTypeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of weaponTypes) map.set(row.id, row.name);
    return map;
  }, [weaponTypes]);

  const weaponGroupSkillIds = useMemo(() => {
    const weaponCategoryIds = new Set(
      categories
        .filter((category) => category.group === 'SKILLGROUP_WEAPON')
        .map((category) => category.id),
    );
    return new Set(
      skills
        .filter((skill) => weaponCategoryIds.has(skill.category))
        .map((skill) => skill.id),
    );
  }, [categories, skills]);

  const languageOptions = useMemo(
    () => languages
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((l) => ({ value: l.id, label: l.name })),
    [languages],
  );

  const languageSkillIds = useMemo(
    () => new Set(skills.filter((s) => s.name.trim().toLowerCase() === 'languages').map((s) => s.id)),
    [skills],
  );

  const spellListNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of spellLists) map.set(s.id, s.name);
    return map;
  }, [spellLists]);

  /** Global reverse map: spellListId → categoryId, covering all categories. */
  const spellListCategoryById = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of characterBuilder.categorySpellLists) {
      for (const slId of entry.spellLists) {
        map.set(slId, entry.category);
      }
    }
    return map;
  }, [characterBuilder.categorySpellLists]);

  /** Convert a spell list ID to a RichSelectOption with category shown muted. */
  const toSpellListRichOption = useCallback((id: string): RichSelectOption => {
    const catId = spellListCategoryById.get(id);
    const rawCatName = catId ? (categoryNameById.get(catId) ?? catId) : undefined;
    const catName = rawCatName?.replace(/^.*?\s-\s/, '');
    const slName = spellListNameById.get(id) ?? id;
    return {
      value: id,
      label: <RichOptionLabel primary={slName} {...(catName ? { secondary: catName } : {})} />,
      searchText: catName ? `${slName} — ${catName}` : slName,
    };
  }, [spellListCategoryById, categoryNameById, spellListNameById]);

  /** Convert a Skill to a RichSelectOption with category name shown muted. */
  const toSkillRichOption = useCallback((s: { id: string; name: string; category: string }): RichSelectOption => {
    const catName = categoryNameById.get(s.category);
    return {
      value: s.id,
      label: <RichOptionLabel primary={s.name} {...(catName ? { secondary: catName } : {})} />,
      searchText: catName ? `${s.name} — ${catName}` : s.name,
    };
  }, [categoryNameById]);

  const raceEverymanSkillOptions = useMemo(() => {
    return raceEverymanChoiceDefinitions.map((choice) => {
      const categorySet = new Set(choice.options);
      return skills
        .filter((s) => categorySet.has(s.category))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(toSkillRichOption);
    });
  }, [raceEverymanChoiceDefinitions, skills, toSkillRichOption]);

  const cultureTypeCategorySkillOptions = useMemo(() => {
    return cultureTypeCategorySkillRankDefinitions.map((choice) => {
      const rows = skillIdsByCategory.get(choice.id) ?? [];
      return rows.map(toSkillRichOption);
    });
  }, [cultureTypeCategorySkillRankDefinitions, skillIdsByCategory, toSkillRichOption]);

  const professionSkillDevelopmentOptions = useMemo(() => {
    return professionSkillDevelopmentChoiceDefinitions.map((choice) => {
      const ids = new Set(choice.options.map((option) => option.id));
      return skills
        .filter((s) => ids.has(s.id))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(toSkillRichOption);
    });
  }, [professionSkillDevelopmentChoiceDefinitions, skills, toSkillRichOption]);

  const professionCategoryDevelopmentOptions = useMemo(() => {
    return professionCategoryDevelopmentChoiceDefinitions.map((choice) => {
      const categorySet = new Set(choice.options);
      return skills
        .filter((s) => categorySet.has(s.category))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(toSkillRichOption);
    });
  }, [professionCategoryDevelopmentChoiceDefinitions, skills, toSkillRichOption]);

  const professionGroupDevelopmentOptions = useMemo(() => {
    return professionGroupDevelopmentChoiceDefinitions.map((choice) => {
      const categorySet = new Set<string>();
      for (const groupId of choice.options) {
        for (const categoryId of categoryIdsByGroup.get(groupId) ?? []) {
          categorySet.add(categoryId);
        }
      }
      return skills
        .filter((s) => categorySet.has(s.category))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(toSkillRichOption);
    });
  }, [professionGroupDevelopmentChoiceDefinitions, categoryIdsByGroup, skills, toSkillRichOption]);

  const pureExtraSpellListOptions = useMemo(() => {
    const fromCategories = [OWN_REALM_OPEN_LISTS_CATEGORY_ID, OWN_REALM_CLOSED_LISTS_CATEGORY_ID]
      .flatMap((catId) => {
        const entry = characterBuilder.categorySpellLists.find((c) => c.category === catId);
        return entry?.spellLists ?? [];
      });
    // Include any already-selected IDs even if the server has since moved them
    // out of the Open/Closed categories into the Base category.
    const pureGroupIndex = professionBaseSpellListChoiceDefinitions.length;
    const currentSelections = (professionBaseSpellListChoiceRows[pureGroupIndex] ?? []).filter(Boolean);
    const allIds = Array.from(new Set([...fromCategories, ...currentSelections]));
    return allIds
      .map(toSpellListRichOption)
      .sort((a, b) => a.searchText!.localeCompare(b.searchText!));
  }, [characterBuilder.categorySpellLists, toSpellListRichOption, professionBaseSpellListChoiceDefinitions.length, professionBaseSpellListChoiceRows]);

  const restrictedProfessions = useMemo(
    () => new Set(culture?.restrictedProfessions ?? []),
    [culture],
  );

  const preferredProfessions = useMemo(
    () => new Set(culture?.preferredProfessions ?? []),
    [culture],
  );

  const raceMatchedProfessionIds = useMemo(() => {
    if (!raceId) return new Set<string>();
    return new Set(
      professions
        .filter((p) => (p.allowedRaces?.length ?? 0) > 0 && p.allowedRaces.includes(raceId))
        .map((p) => p.id),
    );
  }, [professions, raceId]);

  const raceDisallowedProfessionIds = useMemo(() => {
    return new Set(
      professions
        .filter((p) => (p.allowedRaces?.length ?? 0) > 0 && !p.allowedRaces.includes(raceId))
        .map((p) => p.id),
    );
  }, [professions, raceId]);

  const professionOptions = useMemo(() => {
    const raceMatched = professions
      .filter((p) => raceMatchedProfessionIds.has(p.id))
      .sort((a, b) => a.id.localeCompare(b.id));

    const preferred = professions
      .filter((p) => preferredProfessions.has(p.id) && !raceMatchedProfessionIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    const nonPreferred = professions
      .filter((p) => !preferredProfessions.has(p.id) && !raceMatchedProfessionIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    return [...raceMatched, ...preferred, ...nonPreferred].map((p) => {
      const isRestricted = restrictedProfessions.has(p.id);
      const isRaceMatched = raceMatchedProfessionIds.has(p.id);
      const isRaceDisallowed = raceDisallowedProfessionIds.has(p.id);
      const isPreferred = preferredProfessions.has(p.id);
      return {
        value: p.id,
        label: isRaceMatched ? `${p.name} (Racial)` : (isPreferred ? `${p.name} (Culture Preferred)` : p.name),
        disabled: isRestricted || isRaceDisallowed,
        description: p.description,
      };
    });
  }, [professions, preferredProfessions, raceDisallowedProfessionIds, raceMatchedProfessionIds, restrictedProfessions]);

  const predefinedSpellRealms = useMemo(() => {
    if (!profession) return [];
    return profession.realms.filter((r): r is Realm => SPELL_REALMS.includes(r));
  }, [profession]);

  const requiresRealmSelection = predefinedSpellRealms.length === 0;

  const realmOptionsForProfession = useMemo(() => {
    if (!profession || !requiresRealmSelection) return [];
    return SPELL_REALMS.map((r) => ({ value: r, label: r }));
  }, [profession, requiresRealmSelection]);

  const primeStats = useMemo(() => {
    if (!profession) return [];
    return uniqStrings(profession.stats).slice(0, 10) as Stat[];
  }, [profession]);

  const developmentStats = useMemo(() => new Set(DEVELOPMENT_STATS), []);

  const hobbyRankSpent = useMemo(
    () => [...hobbySkillRows, ...hobbyCategoryRows].reduce((sum, row) => sum + Math.max(0, row.value - row.base), 0),
    [hobbySkillRows, hobbyCategoryRows],
  );

  const hobbyRankRemaining = hobbyRanksBudget - hobbyRankSpent;

  const languageRankSpent = useMemo(
    () => hobbyLanguageRows.reduce(
      (sum, row) => sum
        + Math.max(0, row.spoken - row.baseSpoken)
        + Math.max(0, row.written - row.baseWritten)
        + Math.max(0, row.somatic - row.baseSomatic),
      0,
    ),
    [hobbyLanguageRows],
  );

  const languageRankRemaining = languageRanksBudget - languageRankSpent;

  const sortedHobbySkillRows = useMemo(() => {
    return hobbySkillRows
      .map((row, index) => ({
        row,
        index,
        sortLabel: skillNameById.get(row.id) ?? row.id,
        label: `${skillNameById.get(row.id) ?? row.id}${row.subcategory ? ` (${row.subcategory})` : ''}`,
      }))
      .sort((a, b) => a.sortLabel.localeCompare(b.sortLabel));
  }, [hobbySkillRows, skillNameById]);

  const sortedHobbyCategoryRows = useMemo(() => {
    return hobbyCategoryRows
      .map((row, index) => ({
        row,
        index,
        label: categoryNameById.get(row.id) ?? row.id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [hobbyCategoryRows, categoryNameById]);

  const backgroundBudget = Math.max(0, race?.backgroundOptions ?? 0);

  const backgroundState = useMemo<BackgroundOptionState>(() => ({
    extraStatGainRolls: backgroundExtraStatGainRolls,
    extraMoneyPoints: backgroundExtraMoneyPoints,
    extraLanguages: backgroundExtraLanguages,
    languageRows: backgroundLanguageRows,
    skillBonuses: backgroundSkillBonusRows,
    categoryBonusIds: backgroundCategoryBonusIds,
    specialItemsPoints: backgroundSpecialItemsPoints,
  }), [
    backgroundExtraStatGainRolls,
    backgroundExtraMoneyPoints,
    backgroundExtraLanguages,
    backgroundLanguageRows,
    backgroundSkillBonusRows,
    backgroundCategoryBonusIds,
    backgroundSpecialItemsPoints,
  ]);

  const backgroundLanguageRanksBudget = backgroundState.extraLanguages ? 20 : 0;

  const backgroundLanguageRankSpent = useMemo(
    () => getBackgroundLanguageRankSpent(backgroundState.languageRows),
    [backgroundState.languageRows],
  );

  const backgroundLanguageRankRemaining = backgroundLanguageRanksBudget - backgroundLanguageRankSpent;

  const selectedBackgroundPoints = useMemo(
    () => getSelectedBackgroundPoints(backgroundState),
    [backgroundState],
  );

  const selectedBackgroundOptionsPayload = useMemo(() => {
    return getSelectedBackgroundOptionsPayload(backgroundState);
  }, [backgroundState]);

  const backgroundSkillBonusOptions = useMemo(
    (): RichSelectOption[] =>
      skills
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(toSkillRichOption),
    [skills, toSkillRichOption],
  );

  const selectedBackgroundSkillSet = useMemo(
    () => new Set(backgroundSkillBonusRows.map((row) => row.id)),
    [backgroundSkillBonusRows],
  );

  const backgroundSkillCategoryOptions = useMemo((): RichSelectOption[] => {
    const catIds = new Set(skills.map((s) => s.category));
    return Array.from(catIds)
      .map((id): RichSelectOption => ({
        value: id,
        label: categoryNameById.get(id) ?? id,
        searchText: categoryNameById.get(id) ?? id,
      }))
      .sort((a, b) => (a.searchText ?? '').localeCompare(b.searchText ?? ''));
  }, [skills, categoryNameById]);

  const availableBackgroundSkillBonusOptions = useMemo(
    () => backgroundSkillBonusOptions.filter((opt) => {
      const skill = skills.find((s) => s.id === opt.value);
      if (backgroundSkillCategoryFilter && skill?.category !== backgroundSkillCategoryFilter) return false;
      const hasSubcategorySupport = (weaponTypeOptionsBySkillId.get(opt.value) ?? []).length > 0 || mandatorySubcategorySkillIds.has(opt.value);
      return hasSubcategorySupport || !selectedBackgroundSkillSet.has(opt.value);
    }),
    [backgroundSkillBonusOptions, selectedBackgroundSkillSet, weaponTypeOptionsBySkillId, mandatorySubcategorySkillIds, backgroundSkillCategoryFilter, skills],
  );

  const backgroundCategoryBonusOptions = useMemo(
    () =>
      categories
        .slice()
        .sort((a, b) => {
          const aLabel = categoryNameById.get(a.id) ?? a.id;
          const bLabel = categoryNameById.get(b.id) ?? b.id;
          return aLabel.localeCompare(bLabel);
        })
        .map((c) => ({ value: c.id, label: categoryNameById.get(c.id) ?? c.id })),
    [categories, categoryNameById],
  );

  const selectedBackgroundCategorySet = useMemo(() => new Set(backgroundCategoryBonusIds), [backgroundCategoryBonusIds]);
  const availableBackgroundCategoryBonusOptions = useMemo(
    () => backgroundCategoryBonusOptions.filter((opt) => !selectedBackgroundCategorySet.has(opt.value)),
    [backgroundCategoryBonusOptions, selectedBackgroundCategorySet],
  );

  const availableTrainingPackages = useMemo(() => {
    if (!raceId) return [];
    const raceFiltered = trainingPackages.filter((tp) => {
      const races = Array.isArray(tp.races) ? tp.races : [];
      return races.length === 0 || races.includes(raceId);
    });

    if (!culture) return raceFiltered;

    const modifierIds = new Set(culture.trainingPackageModifiers.map((m) => m.id));
    const preferred = raceFiltered.filter((tp) => modifierIds.has(tp.id));
    const rest = raceFiltered.filter((tp) => !modifierIds.has(tp.id));
    return [...preferred, ...rest];
  }, [trainingPackages, raceId, culture]);

  const selectedApprenticeTrainingPackages = useMemo(
    () => apprenticeTrainingPackageIds
      .map((id) => availableTrainingPackages.find((tp) => tp.id === id))
      .filter((tp): tp is TrainingPackage => tp !== undefined),
    [availableTrainingPackages, apprenticeTrainingPackageIds],
  );

  const tpCostMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of characterBuilder.trainingPackageCosts) {
      map.set(row.id, row.value);
    }
    return map;
  }, [characterBuilder.trainingPackageCosts]);

  const categoryCostMap = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const row of characterBuilder.categoryCosts) {
      map.set(row.category, parseCostString(row.cost));
    }
    return map;
  }, [characterBuilder.categoryCosts]);

  const skillDevTypeMap = useMemo(() => {
    const map = new Map<string, SkillDevelopmentType>();
    for (const row of characterBuilder.skillDevelopmentTypes) {
      map.set(row.id, row.value);
    }
    return map;
  }, [characterBuilder.skillDevelopmentTypes]);

  const skillCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of skills) map.set(s.id, s.category);
    return map;
  }, [skills]);

  const apprenticeSelectedLifestylePackageId = useMemo(() => {
    return apprenticeTrainingPackageIds.find((tpId) => {
      const tp = trainingPackages.find((t) => t.id === tpId);
      return tp?.lifestyle;
    }) ?? null;
  }, [apprenticeTrainingPackageIds, trainingPackages]);

  const apprenticeStatGainsUnavailable = useMemo((): Set<Stat> => {
    const claimed = new Set<Stat>();
    for (const tp of selectedApprenticeTrainingPackages) {
      for (const stat of tp.statGains ?? []) {
        claimed.add(stat);
      }
      if (tp.realmStatGain) {
        for (const realm of characterBuilder.magicalRealms) {
          const stat = getStatForRealm(realm);
          if (stat) claimed.add(stat);
        }
      }
      const res = tpResolutions.find((r) => r.tpId === tp.id);
      if (res) {
        for (const stat of res.statGainChoices) {
          if (stat) claimed.add(stat);
        }
      }
    }
    return claimed;
  }, [selectedApprenticeTrainingPackages, tpResolutions, characterBuilder.magicalRealms]);

  useEffect(() => {
    if (apprenticeStatGainsUnavailable.size === 0) return;
    setApprenticeStatGains((prev) => prev.filter((s) => !apprenticeStatGainsUnavailable.has(s)));
  }, [apprenticeStatGainsUnavailable]);

  const tpGrantedSkillRankCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const tp of selectedApprenticeTrainingPackages) {
      for (const rank of tp.skillRanks ?? []) {
        map.set(rank.id, (map.get(rank.id) ?? 0) + rank.value);
      }
      const res = tpResolutions.find((r) => r.tpId === tp.id);
      if (!res) continue;
      for (let gi = 0; gi < (tp.skillRankChoices ?? []).length; gi++) {
        for (const alloc of res.skillRankChoices[gi] ?? []) {
          if (alloc.id) map.set(alloc.id, (map.get(alloc.id) ?? 0) + alloc.ranks);
        }
      }
      for (let gi = 0; gi < (tp.categoryMultiSkillRankChoices ?? []).length; gi++) {
        for (const alloc of res.categoryMultiSkillChoices[gi] ?? []) {
          if (alloc.id) map.set(alloc.id, (map.get(alloc.id) ?? 0) + alloc.ranks);
        }
      }
      for (let gi = 0; gi < (tp.groupMultiSkillRankChoices ?? []).length; gi++) {
        for (const alloc of res.groupMultiSkillChoices[gi] ?? []) {
          if (alloc.id) map.set(alloc.id, (map.get(alloc.id) ?? 0) + alloc.ranks);
        }
      }
      for (let gi = 0; gi < (tp.groupCategoryAndSkillRankChoices ?? []).length; gi++) {
        const choiceDef = (tp.groupCategoryAndSkillRankChoices ?? [])[gi];
        const slot = res.groupCategoryAndSkillChoices[gi];
        if (choiceDef && slot?.skillId) {
          map.set(slot.skillId, (map.get(slot.skillId) ?? 0) + choiceDef.value);
        }
      }
    }
    return map;
  }, [selectedApprenticeTrainingPackages, tpResolutions]);

  const tpGrantedCategoryRankCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const tp of selectedApprenticeTrainingPackages) {
      for (const rank of tp.categoryRanks ?? []) {
        map.set(rank.id, (map.get(rank.id) ?? 0) + rank.value);
      }
      const res = tpResolutions.find((r) => r.tpId === tp.id);
      if (!res) continue;
      for (let gi = 0; gi < (tp.groupCategoryAndSkillRankChoices ?? []).length; gi++) {
        const choiceDef = (tp.groupCategoryAndSkillRankChoices ?? [])[gi];
        const slot = res.groupCategoryAndSkillChoices[gi];
        if (choiceDef && slot?.categoryId) {
          map.set(slot.categoryId, (map.get(slot.categoryId) ?? 0) + choiceDef.value);
        }
      }
    }
    return map;
  }, [selectedApprenticeTrainingPackages, tpResolutions]);

  const tpGrantedSpellListRankCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const tp of selectedApprenticeTrainingPackages) {
      const res = tpResolutions.find((r) => r.tpId === tp.id);
      if (!res) continue;
      const choiceableSlRanks = (tp.spellListRanks ?? []).filter((r) => r.numChoices > 0);
      for (let gi = 0; gi < choiceableSlRanks.length; gi++) {
        for (const alloc of res.spellListChoices[gi] ?? []) {
          if (alloc.id) map.set(alloc.id, (map.get(alloc.id) ?? 0) + alloc.ranks);
        }
      }
      for (let gi = 0; gi < (tp.spellListCategoryRankChoices ?? []).length; gi++) {
        for (const alloc of res.spellListCategoryChoices[gi] ?? []) {
          if (alloc.id) map.set(alloc.id, (map.get(alloc.id) ?? 0) + alloc.ranks);
        }
      }
    }
    return map;
  }, [selectedApprenticeTrainingPackages, tpResolutions]);

  const tpsRequiringResolution = useMemo(
    () => selectedApprenticeTrainingPackages.filter(tpHasChoices),
    [selectedApprenticeTrainingPackages],
  );

  const apprenticeTrainingPackageDpCost = useMemo(() => {
    return apprenticeTrainingPackageIds.reduce((total, tpId) => {
      return total + (tpCostMap.get(tpId) ?? 0);
    }, 0);
  }, [apprenticeTrainingPackageIds, tpCostMap]);

  const apprenticeStatGainDpCost = apprenticeStatGains.length * STAT_GAIN_DP_COST;

  const apprenticeSkillDpCost = useMemo(() => {
    return apprenticeSkillPurchases.reduce((total, p) => {
      const categoryId = skillCategoryMap.get(p.id);
      if (!categoryId) return total;
      const costElements = categoryCostMap.get(categoryId) ?? [];
      const devType = skillDevTypeMap.get(p.id);
      const tpRanks = tpGrantedSkillRankCounts.get(p.id) ?? 0;
      return total + getSkillDpCostWithTpOffset(costElements, devType, p.purchases, tpRanks);
    }, 0);
  }, [apprenticeSkillPurchases, categoryCostMap, skillDevTypeMap, skillCategoryMap, tpGrantedSkillRankCounts]);

  const apprenticeCategoryDpCost = useMemo(() => {
    return apprenticeCategoryPurchases.reduce((total, p) => {
      const costElements = categoryCostMap.get(p.id) ?? [];
      const tpRanks = tpGrantedCategoryRankCounts.get(p.id) ?? 0;
      return total + getCategoryDpCostWithTpOffset(costElements, p.purchases, tpRanks);
    }, 0);
  }, [apprenticeCategoryPurchases, categoryCostMap, tpGrantedCategoryRankCounts]);

  const apprenticeSpellListDpCost = useMemo(() => {
    return apprenticeSpellListPurchases.reduce((total, p) => {
      const catEntry = characterBuilder.categorySpellLists.find((c) => c.spellLists.includes(p.id));
      if (!catEntry) return total;
      const costElements = categoryCostMap.get(catEntry.category) ?? [];
      const tpRanks = tpGrantedSpellListRankCounts.get(p.id) ?? 0;
      return total + getCategoryDpCostWithTpOffset(costElements, p.purchases, tpRanks);
    }, 0);
  }, [apprenticeSpellListPurchases, categoryCostMap, characterBuilder.categorySpellLists, tpGrantedSpellListRankCounts]);

  const apprenticeTotalDpSpent = apprenticeTrainingPackageDpCost + apprenticeStatGainDpCost + apprenticeSkillDpCost + apprenticeCategoryDpCost + apprenticeSpellListDpCost;
  const apprenticeDpRemaining = characterBuilder.developmentPoints - apprenticeTotalDpSpent;

  const apprenticeTrainingPackageOptions = useMemo(() => {
    const selectedSet = new Set(apprenticeTrainingPackageIds);
    return availableTrainingPackages
      .filter((tp) => {
        if (selectedSet.has(tp.id)) return false;
        if (tp.lifestyle && apprenticeSelectedLifestylePackageId !== null) return false;
        const cost = tpCostMap.get(tp.id) ?? 0;
        if (cost > apprenticeDpRemaining) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((tp): RichSelectOption => {
        const cost = tpCostMap.get(tp.id) ?? '?';
        const secondary = tp.lifestyle ? `(Lifestyle) \u2014 ${cost} DP` : `${cost} DP`;
        return {
          value: tp.id,
          label: <RichOptionLabel primary={tp.name} secondary={secondary} />,
          searchText: `${tp.name} ${secondary}`,
          title: showDescriptions && tp.description ? tp.description : undefined,
        };
      });
  }, [availableTrainingPackages, apprenticeTrainingPackageIds, apprenticeSelectedLifestylePackageId, tpCostMap, apprenticeDpRemaining, showDescriptions]);

  const apprenticeAvailableSkills = useMemo(() => {
    const selectedSet = new Set(apprenticeSkillPurchases.map((p) => p.id));
    return skills.filter((s) => {
      if (selectedSet.has(s.id)) return false;
      const costElements = categoryCostMap.get(s.category) ?? [];
      const devType = skillDevTypeMap.get(s.id);
      const tpRanks = tpGrantedSkillRankCounts.get(s.id) ?? 0;
      return getSkillMaxDpPurchases(costElements, devType, tpRanks) > 0;
    });
  }, [skills, apprenticeSkillPurchases, categoryCostMap, skillDevTypeMap, tpGrantedSkillRankCounts]);

  const apprenticeSkillCategoryOptions = useMemo((): RichSelectOption[] => {
    const catIds = new Set(apprenticeAvailableSkills.map((s) => s.category));
    return Array.from(catIds)
      .map((id): RichSelectOption => {
        const costElements = categoryCostMap.get(id) ?? [];
        const firstRankCost = getSkillDpCostWithTpOffset(costElements, undefined, 1, 0);
        const name = categoryNameById.get(id) ?? id;
        const secondary = `${firstRankCost} DP`;
        return {
          value: id,
          label: <RichOptionLabel primary={name} secondary={secondary} />,
          searchText: `${name} \u2014 ${secondary}`,
        };
      })
      .sort((a, b) => (a.searchText ?? '').localeCompare(b.searchText ?? ''));
  }, [apprenticeAvailableSkills, categoryNameById, categoryCostMap]);

  const apprenticeSkillOptions = useMemo(() => {
    return apprenticeAvailableSkills
      .filter((s) => !apprenticeSkillCategoryFilter || s.category === apprenticeSkillCategoryFilter)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s): RichSelectOption => {
        const costElements = categoryCostMap.get(s.category) ?? [];
        const devType = skillDevTypeMap.get(s.id);
        const tpRanks = tpGrantedSkillRankCounts.get(s.id) ?? 0;
        const nextRankCost = getSkillDpCostWithTpOffset(costElements, devType, 1, tpRanks);
        const secondary = devType ? `${devType} \u2014 ${nextRankCost} DP` : `${nextRankCost} DP`;
        return {
          value: s.id,
          label: <RichOptionLabel primary={s.name} secondary={secondary} />,
          searchText: `${s.name} ${secondary}`,
        };
      });
  }, [apprenticeAvailableSkills, apprenticeSkillCategoryFilter, categoryCostMap, skillDevTypeMap, tpGrantedSkillRankCounts]);

  const apprenticeCategoryOptions = useMemo(() => {
    const selectedSet = new Set(apprenticeCategoryPurchases.map((p) => p.id));
    return categories
      .filter((c) => {
        if (selectedSet.has(c.id)) return false;
        const costElements = categoryCostMap.get(c.id) ?? [];
        const tpRanks = tpGrantedCategoryRankCounts.get(c.id) ?? 0;
        return getCategoryMaxDpPurchases(costElements, tpRanks) > 0;
      })
      .sort((a, b) => {
        const aLabel = categoryNameById.get(a.id) ?? a.id;
        const bLabel = categoryNameById.get(b.id) ?? b.id;
        return aLabel.localeCompare(bLabel);
      })
      .map((c): RichSelectOption => {
        const costElements = categoryCostMap.get(c.id) ?? [];
        const tpRanks = tpGrantedCategoryRankCounts.get(c.id) ?? 0;
        const nextRankCost = getCategoryDpCostWithTpOffset(costElements, 1, tpRanks);
        const baseLabel = categoryNameById.get(c.id) ?? c.id;
        const secondary = `${nextRankCost} DP`;
        return {
          value: c.id,
          label: <RichOptionLabel primary={baseLabel} secondary={secondary} />,
          searchText: `${baseLabel} \u2014 ${secondary}`,
        };
      });
  }, [categories, apprenticeCategoryPurchases, categoryCostMap, categoryNameById, tpGrantedCategoryRankCounts]);

  const apprenticeSpellCategoryOptions = useMemo(
    () => characterBuilder.categorySpellLists
      .map((c): RichSelectOption => {
        const costElements = categoryCostMap.get(c.category) ?? [];
        const nextRankCost = getCategoryOrSpellListPurchaseTotalCost(costElements, 1);
        const catName = categoryNameById.get(c.category) ?? c.category;
        const secondary = `${nextRankCost} DP / rank`;
        return {
          value: c.category,
          label: <RichOptionLabel primary={catName} secondary={secondary} />,
          searchText: `${catName} \u2014 ${secondary}`,
        };
      })
      .sort((a, b) => (a.searchText ?? '').localeCompare(b.searchText ?? '')),
    [characterBuilder.categorySpellLists, categoryNameById, categoryCostMap],
  );

  const apprenticeSpellListsInSelectedCategory = useMemo(() => {
    if (!apprenticeSelectedSpellCategory) return [];
    const catEntry = characterBuilder.categorySpellLists.find((c) => c.category === apprenticeSelectedSpellCategory);
    if (!catEntry) return [];
    const purchasedIds = new Set(apprenticeSpellListPurchases.map((p) => p.id));
    return catEntry.spellLists
      .filter((slId) => !purchasedIds.has(slId))
      .map((slId) => ({ id: slId, name: spellListNameById.get(slId) ?? slId }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [apprenticeSelectedSpellCategory, characterBuilder.categorySpellLists, spellListNameById, apprenticeSpellListPurchases]);

  useEffect(() => {
    if (!cultureTypeId) {
      if (cultureId) setCultureId('');
      return;
    }
    if (cultureId && !availableCultures.some((x) => x.id === cultureId)) {
      setCultureId('');
    }
  }, [cultureTypeId, cultureId, availableCultures]);

  useEffect(() => {
    if (!culture) return;
    if (professionId && restrictedProfessions.has(professionId)) {
      setProfessionId('');
    }
  }, [culture, professionId, restrictedProfessions]);

  useEffect(() => {
    if (professionId && raceDisallowedProfessionIds.has(professionId)) {
      setProfessionId('');
    }
  }, [professionId, raceDisallowedProfessionIds]);

  useEffect(() => {
    if (!profession) {
      setSelectedRealms([]);
      return;
    }

    if (!requiresRealmSelection) {
      setSelectedRealms(predefinedSpellRealms);
      return;
    }

    setSelectedRealms((current) => {
      const [first] = current;
      if (first && SPELL_REALMS.includes(first)) {
        return [first];
      }
      return [];
    });
  }, [profession, predefinedSpellRealms, requiresRealmSelection]);

  useEffect(() => {
    setRaceEverymanChoiceRows((prev) => raceEverymanChoiceDefinitions.map((choice, i) => {
      const existing = prev[i] ?? [];
      return Array.from({ length: choice.numChoices }, (_, slot) => {
        const current = existing[slot];
        return {
          id: current?.id ?? '',
          subcategory: current?.subcategory ?? '',
        };
      });
    }));
  }, [raceEverymanChoiceDefinitions]);

  useEffect(() => {
    setCultureTypeCategorySkillRankRows((prev) => cultureTypeCategorySkillRankDefinitions.map((_, i) => {
      const current = prev[i];
      return {
        id: current?.id ?? '',
        subcategory: current?.subcategory ?? '',
      };
    }));
  }, [cultureTypeCategorySkillRankDefinitions]);

  useEffect(() => {
    setProfessionSkillDevelopmentChoiceRows((prev) => professionSkillDevelopmentChoiceDefinitions.map((choice, i) => {
      const existing = prev[i] ?? [];
      return Array.from({ length: choice.numChoices }, (_, slot) => {
        const current = existing[slot];
        return {
          id: current?.id ?? '',
          subcategory: current?.subcategory ?? '',
        };
      });
    }));
  }, [professionSkillDevelopmentChoiceDefinitions]);

  useEffect(() => {
    setProfessionCategoryDevelopmentChoiceRows((prev) => professionCategoryDevelopmentChoiceDefinitions.map((choice, i) => {
      const existing = prev[i] ?? [];
      return Array.from({ length: choice.numChoices }, (_, slot) => {
        const current = existing[slot];
        return {
          id: current?.id ?? '',
          subcategory: current?.subcategory ?? '',
        };
      });
    }));
  }, [professionCategoryDevelopmentChoiceDefinitions]);

  useEffect(() => {
    setProfessionGroupDevelopmentChoiceRows((prev) => professionGroupDevelopmentChoiceDefinitions.map((choice, i) => {
      const existing = prev[i] ?? [];
      return Array.from({ length: choice.numChoices }, (_, slot) => {
        const current = existing[slot];
        return {
          id: current?.id ?? '',
          subcategory: current?.subcategory ?? '',
        };
      });
    }));
  }, [professionGroupDevelopmentChoiceDefinitions]);

  useEffect(() => {
    setProfessionBaseSpellListChoiceRows((prev) => {
      const rows = professionBaseSpellListChoiceDefinitions.map((choice, i) => {
        const existing = prev[i] ?? [];
        return Array.from({ length: choice.numChoices }, (_, slot) => existing[slot] ?? '');
      });
      if (profession?.spellUserType === 'Pure') {
        const pureGroupIndex = professionBaseSpellListChoiceDefinitions.length;
        const existingPure = prev[pureGroupIndex] ?? [];
        rows.push(Array.from({ length: PURE_EXTRA_SPELL_LIST_COUNT }, (_, slot) => existingPure[slot] ?? ''));
      }
      return rows;
    });
  }, [professionBaseSpellListChoiceDefinitions, profession?.spellUserType]);

  useEffect(() => {
    const allowedIds = new Set(weaponSkillCategoryOptions.map((opt) => opt.value));
    setProfessionWeaponCategoryCostSelections((prev) => professionWeaponCategoryCostDefinitions.map((def, index) => {
      const existing = prev[index];
      if (existing && allowedIds.has(existing)) return existing;
      return allowedIds.has(def.defaultCategory) ? def.defaultCategory : '';
    }));
  }, [professionWeaponCategoryCostDefinitions, weaponSkillCategoryOptions]);

  useEffect(() => {
    if (selectedBackgroundPoints <= backgroundBudget) return;

    const reset = createEmptyBackgroundOptionState();
    setBackgroundSpecialItemsPoints(reset.specialItemsPoints);
    setBackgroundCategoryBonusIds(reset.categoryBonusIds);
    setBackgroundSkillBonusRows(reset.skillBonuses);
    setBackgroundExtraLanguages(reset.extraLanguages);
    setBackgroundExtraMoneyPoints(reset.extraMoneyPoints);
    setBackgroundExtraStatGainRolls(reset.extraStatGainRolls);
  }, [selectedBackgroundPoints, backgroundBudget]);

  useEffect(() => {
    if (!backgroundExtraLanguages) {
      setBackgroundLanguageRows([]);
      return;
    }

    setBackgroundLanguageRows(createBackgroundLanguageRows(culture, characterBuilder.languageAbilities));
  }, [backgroundExtraLanguages, culture]);

  useEffect(() => {
    setCharacterBuilder((prev) => ({
      ...prev,
      name: characterName,
      male: isMale,
      race: raceId,
      culture: cultureId,
      cultureType: cultureTypeId,
      profession: professionId,
      magicalRealms: selectedRealms,
      everymanSkills: race?.everymanSkills ?? [],
      restricted_skills: race?.restrictedSkills ?? [],
      everyman_skill_categories: race?.everymanCategories ?? [],
      restricted_skill_categories: race?.restrictedCategories ?? [],
      realmProgressions: selectedRealms.map((realm) => ({
        id: realm,
        value:
          realm === 'Arcane' ? (race?.arcaneProgression ?? '')
            : realm === 'Arms' ? (race?.armsProgression ?? '')
              : realm === 'Channeling' ? (race?.channelingProgression ?? '')
                : realm === 'Essence' ? (race?.essenceProgression ?? '')
                  : realm === 'Mentalism' ? (race?.mentalismProgression ?? '')
                    : '',
      })),
      stats: statRolls
        .filter((roll): roll is StatRoll & { assignedStat: Stat } => Boolean(roll.assignedStat))
        .map((roll) => ({
          stat: roll.assignedStat,
          temporary: Number(roll.temporary) || 0,
          potential: roll.potential ?? 0,
          racialBonus: (race?.statBonuses.find((b) => b.id === roll.assignedStat)?.value ?? 0)
            + apprenticeStatGains.filter((s) => s === roll.assignedStat).length,
        })),
    }));
  }, [characterName, isMale, raceId, cultureTypeId, cultureId, professionId, selectedRealms, statRolls, race, apprenticeStatGains]);

  useEffect(() => {
    setCharacterBuilder((prev) => ({
      ...prev,
      hobbySkillRanks: hobbySkillRows.map((row) => ({
        id: row.id,
        subcategory: row.subcategory,
        value: row.value,
      })),
      hobbyCategoryRanks: hobbyCategoryRows.map((row) => ({
        id: row.id,
        value: row.value,
      })),
      languageAbilities: hobbyLanguageRows.map((row) => ({
        language: row.language,
        ...(row.spoken > 0 ? { spoken: row.spoken } : {}),
        ...(row.written > 0 ? { written: row.written } : {}),
        ...(row.somatic > 0 ? { somatic: row.somatic } : {}),
      })),
      adolescentSpellListChoice: spellListRanksBudget > 0 && hobbySpellListId
        ? hobbySpellListId
        : null,
    }));
  }, [hobbySkillRows, hobbyCategoryRows, hobbyLanguageRows, hobbySpellListId, spellListRanksBudget]);

  useEffect(() => {
    if (!profession) {
      setCharacterBuilder((prev) => ({
        ...prev,
        skillDevelopmentTypes: [],
        categorySpecialBonuses: [],
        groupSpecialBonuses: [],
      }));
      return;
    }

    setCharacterBuilder((prev) => ({
      ...prev,
      skillDevelopmentTypes: profession.skillDevelopmentTypes.map((item) => ({
        id: item.id,
        subcategory: item.subcategory,
        value: item.value,
      })),
      categorySpecialBonuses: profession.skillCategorySpecialBonuses.map((item) => ({
        id: item.id,
        value: item.value,
      })),
      groupSpecialBonuses: profession.skillGroupSpecialBonuses.map((item) => ({
        id: item.id,
        value: item.value,
      })),
    }));
  }, [profession]);

  useEffect(() => {
    const raceCategoryEverymanChoices = raceEverymanChoiceRows
      .flatMap((rows) => rows)
      .filter((row) => row.id)
      .map((row) => ({
        id: row.id,
        subcategory: row.subcategory.trim() || undefined,
      }));

    const cultureTypeCategorySkillRanks = cultureTypeCategorySkillRankDefinitions
      .flatMap((def, index) => {
        const row = cultureTypeCategorySkillRankRows[index];
        if (!row?.id) return [];
        return [{
          id: row.id,
          subcategory: row.subcategory.trim() || undefined,
          value: def.value,
        }];
      });

    const profSkillDevelopmentTypeChoices = professionSkillDevelopmentChoiceDefinitions
      .flatMap((def, index) => {
        const rows = professionSkillDevelopmentChoiceRows[index] ?? [];
        return rows
          .filter((row) => row.id)
          .map((row) => ({
            id: row.id,
            subcategory: row.subcategory.trim() || undefined,
            value: def.type,
          }));
      });

    const profCategoryDevelopmentTypeChoices = professionCategoryDevelopmentChoiceDefinitions
      .flatMap((def, index) => {
        const rows = professionCategoryDevelopmentChoiceRows[index] ?? [];
        return rows
          .filter((row) => row.id)
          .map((row) => ({
            id: row.id,
            subcategory: row.subcategory.trim() || undefined,
            value: def.type,
          }));
      });

    const profGroupDevelopmentTypeChoices = professionGroupDevelopmentChoiceDefinitions
      .flatMap((def, index) => {
        const rows = professionGroupDevelopmentChoiceRows[index] ?? [];
        return rows
          .filter((row) => row.id)
          .map((row) => ({
            id: row.id,
            subcategory: row.subcategory.trim() || undefined,
            value: def.type,
          }));
      });

    const baseSpellListChoices = uniqStrings([
      ...fixedProfessionBaseSpellLists,
      ...professionBaseSpellListChoiceRows.flatMap((rows) => rows.filter(Boolean)),
    ]);

    const weaponCategoryCostChoices = professionWeaponCategoryCostDefinitions.map((def, index) => ({
      category: professionWeaponCategoryCostSelections[index] || def.defaultCategory,
      cost: def.cost,
    }));

    setCharacterBuilder((prev) => ({
      ...prev,
      raceCategoryEverymanChoices,
      cultureTypeCategorySkillRanks,
      profSkillDevelopmentTypeChoices,
      profCategoryDevelopmentTypeChoices,
      profGroupDevelopmentTypeChoices,
      baseSpellListChoices,
      weaponCategoryCostChoices,
    }));
  }, [
    raceEverymanChoiceRows,
    cultureTypeCategorySkillRankDefinitions,
    cultureTypeCategorySkillRankRows,
    professionSkillDevelopmentChoiceDefinitions,
    professionSkillDevelopmentChoiceRows,
    professionCategoryDevelopmentChoiceDefinitions,
    professionCategoryDevelopmentChoiceRows,
    professionGroupDevelopmentChoiceDefinitions,
    professionGroupDevelopmentChoiceRows,
    professionBaseSpellListChoiceRows,
    professionWeaponCategoryCostSelections,
    professionWeaponCategoryCostDefinitions,
    fixedProfessionBaseSpellLists,
  ]);

  useEffect(() => {
    const mappedBackgroundLanguages = backgroundState.extraLanguages
      ? backgroundState.languageRows.map((row) => ({
        language: row.language,
        ...(row.spoken > 0 ? { spoken: row.spoken } : {}),
        ...(row.written > 0 ? { written: row.written } : {}),
        ...(row.somatic > 0 ? { somatic: row.somatic } : {}),
      }))
      : [];

    setCharacterBuilder((prev) => ({
      ...prev,
      skillProfessionalBonuses: backgroundState.skillBonuses.map((row) => ({
        id: row.id,
        subcategory: row.subcategory.trim() || undefined,
        value: 10,
      })),
      categoryProfessionalBonuses: backgroundState.categoryBonusIds.map((id) => ({
        id,
        value: 5,
      })),
      backgroundLanguageChoices: mappedBackgroundLanguages,
      languageAbilities: mappedBackgroundLanguages,
    }));
  }, [backgroundState]);

  useEffect(() => {
    setTpResolutions((prev) => {
      const resMap = new Map(prev.map((r) => [r.tpId, r]));
      return selectedApprenticeTrainingPackages.map((tp) => resMap.get(tp.id) ?? createEmptyTpResolution(tp));
    });
  }, [selectedApprenticeTrainingPackages]);

  useEffect(() => {
    // Aggregate ranks from all selected training packages including resolved TP choices
    const tpSkillRanks: Array<{ id: string; subcategory?: string; value: number }> = [];
    const tpCategoryRanks: Array<{ id: string; value: number }> = [];
    const tpSpellListRanks: Array<{ id: string; value: number }> = [];

    for (const tp of selectedApprenticeTrainingPackages) {
      for (const rank of tp.skillRanks ?? []) {
        tpSkillRanks.push({ id: rank.id, ...(rank.subcategory ? { subcategory: rank.subcategory } : {}), value: rank.value });
      }
      for (const rank of tp.categoryRanks ?? []) {
        tpCategoryRanks.push({ id: rank.id, value: rank.value });
      }
      for (const rank of (tp.spellListRanks ?? []).filter((r) => r.numChoices <= 0)) {
        if (rank.optionalCategory) {
          tpSpellListRanks.push({ id: rank.optionalCategory, value: rank.value });
        }
      }
      // Include resolved choices
      const res = tpResolutions.find((r) => r.tpId === tp.id);
      if (res) {
        for (let gi = 0; gi < (tp.skillRankChoices ?? []).length; gi++) {
          for (const alloc of res.skillRankChoices[gi] ?? []) {
            if (alloc.id) tpSkillRanks.push({ id: alloc.id, ...(alloc.subcategory ? { subcategory: alloc.subcategory } : {}), value: alloc.ranks });
          }
        }
        for (let gi = 0; gi < (tp.categoryMultiSkillRankChoices ?? []).length; gi++) {
          for (const alloc of res.categoryMultiSkillChoices[gi] ?? []) {
            if (alloc.id) tpSkillRanks.push({ id: alloc.id, ...(alloc.subcategory ? { subcategory: alloc.subcategory } : {}), value: alloc.ranks });
          }
        }
        for (let gi = 0; gi < (tp.groupMultiSkillRankChoices ?? []).length; gi++) {
          for (const alloc of res.groupMultiSkillChoices[gi] ?? []) {
            if (alloc.id) tpSkillRanks.push({ id: alloc.id, ...(alloc.subcategory ? { subcategory: alloc.subcategory } : {}), value: alloc.ranks });
          }
        }
        for (let gi = 0; gi < (tp.groupCategoryAndSkillRankChoices ?? []).length; gi++) {
          const choiceDef = (tp.groupCategoryAndSkillRankChoices ?? [])[gi];
          if (!choiceDef) continue;
          const slot = res.groupCategoryAndSkillChoices[gi];
          if (!slot) continue;
          if (slot.categoryId) tpCategoryRanks.push({ id: slot.categoryId, value: choiceDef.value });
          if (slot.skillId) tpSkillRanks.push({ id: slot.skillId, ...(slot.subcategory ? { subcategory: slot.subcategory } : {}), value: choiceDef.value });
        }
        const choiceableSlRanks = (tp.spellListRanks ?? []).filter((r) => r.numChoices > 0);
        for (let gi = 0; gi < choiceableSlRanks.length; gi++) {
          for (const alloc of res.spellListChoices[gi] ?? []) {
            if (alloc.id) tpSpellListRanks.push({ id: alloc.id, value: alloc.ranks });
          }
        }
        for (let gi = 0; gi < (tp.spellListCategoryRankChoices ?? []).length; gi++) {
          for (const alloc of res.spellListCategoryChoices[gi] ?? []) {
            if (alloc.id) tpSpellListRanks.push({ id: alloc.id, value: alloc.ranks });
          }
        }
      }
    }

    // Add apprentice DP-purchased skill ranks
    for (const p of apprenticeSkillPurchases) {
      const categoryId = skillCategoryMap.get(p.id);
      if (!categoryId) continue;
      const devType = skillDevTypeMap.get(p.id);
      const ranksPerPurchase = getSkillRanksPerPurchase(devType);
      const totalRanks = devType === 'Restricted'
        ? p.purchases  // each purchase = 1 rank for Restricted
        : p.purchases * ranksPerPurchase;
      if (totalRanks > 0) {
        tpSkillRanks.push({ id: p.id, ...(p.subcategory ? { subcategory: p.subcategory } : {}), value: totalRanks });
      }
    }

    // Add apprentice DP-purchased category ranks
    for (const p of apprenticeCategoryPurchases) {
      if (p.purchases > 0) {
        tpCategoryRanks.push({ id: p.id, value: p.purchases });
      }
    }

    // Add apprentice DP-purchased spell list ranks
    for (const p of apprenticeSpellListPurchases) {
      if (p.purchases > 0) {
        tpSpellListRanks.push({ id: p.id, value: p.purchases });
      }
    }

    setCharacterBuilder((prev) => ({
      ...prev,
      skillRanks: tpSkillRanks,
      categoryRanks: tpCategoryRanks,
      spellListRanks: tpSpellListRanks,
      numHobbySkillRanks: (prev.hobbySkillRanks ?? []).reduce((sum, row) => sum + row.value, 0),
      numAdolescentSpellListRanks: tpSpellListRanks.reduce((sum, row) => sum + row.value, 0),
    }));
  }, [selectedApprenticeTrainingPackages, apprenticeSkillPurchases, apprenticeCategoryPurchases, apprenticeSpellListPurchases, skillCategoryMap, skillDevTypeMap, tpResolutions]);

  const validateInitial = (): string | undefined => {
    if (!characterName.trim()) return 'Name is required.';
    if (!raceId) return 'Race is required.';
    if (!cultureTypeId) return 'Culture Type is required.';
    if (!cultureId) return 'Culture is required.';
    if (!professionId) return 'Profession is required.';
    if (restrictedProfessions.has(professionId)) {
      return 'Selected profession is restricted by the selected culture.';
    }
    if (raceDisallowedProfessionIds.has(professionId)) {
      return 'Selected profession is not allowed for the selected race.';
    }
    if (!profession) {
      return 'Selected profession has no valid realms.';
    }

    if (!requiresRealmSelection) {
      if (selectedRealms.length === 0) return 'Selected profession has no valid spell realms.';
      return undefined;
    }

    if (selectedRealms.length !== 1) return 'Exactly one realm is required.';
    if (!realmOptionsForProfession.some((r) => r.value === selectedRealms[0])) return 'Selected realm is not valid for this profession.';
    return undefined;
  };

  const validateInitialChoices = (): string | undefined => {
    for (let choiceIndex = 0; choiceIndex < raceEverymanChoiceDefinitions.length; choiceIndex++) {
      const choice = raceEverymanChoiceDefinitions[choiceIndex];
      const rows = raceEverymanChoiceRows[choiceIndex] ?? [];
      if (!choice) continue;
      for (let slot = 0; slot < choice.numChoices; slot++) {
        const row = rows[slot];
        if (!row?.id) {
          return `Racial Everyman Skills choice ${choiceIndex + 1}: select a skill for slot ${slot + 1}.`;
        }
        const weaponTypeOptions = weaponTypeOptionsBySkillId.get(row.id) ?? [];
        if (weaponTypeOptions.length > 0 && !row.subcategory.trim()) {
          const skillName = skillNameById.get(row.id) ?? row.id;
          return `Racial Everyman Skills choice ${choiceIndex + 1}: select weapon type for ${skillName}.`;
        }
        if (weaponTypeOptions.length === 0 && mandatorySubcategorySkillIds.has(row.id) && !row.subcategory.trim()) {
          const skillName = skillNameById.get(row.id) ?? row.id;
          return `Racial Everyman Skills choice ${choiceIndex + 1}: enter subcategory for ${skillName}.`;
        }
        // Check for duplicate id+subcategory combinations within the same choice
        const duplicateExists = rows.slice(0, slot).some(
          (other) => other.id === row.id && other.subcategory === row.subcategory,
        );
        if (duplicateExists) {
          const skillName = skillNameById.get(row.id) ?? row.id;
          return `Racial Everyman Skills choice ${choiceIndex + 1}: duplicate selection for ${skillName} — choose a different subcategory.`;
        }
      }
    }

    for (let i = 0; i < cultureTypeCategorySkillRankDefinitions.length; i++) {
      const def = cultureTypeCategorySkillRankDefinitions[i];
      const row = cultureTypeCategorySkillRankRows[i];
      if (!def) continue;
      if (!row?.id) {
        const categoryLabel = categoryNameById.get(def.id) ?? def.id;
        return `Skill Category Skill Ranks: select a skill for ${categoryLabel}.`;
      }

      const weaponTypeOptions = weaponTypeOptionsBySkillId.get(row.id) ?? [];
      if (mandatorySubcategorySkillIds.has(row.id) && weaponTypeOptions.length === 0) {
        const skillName = skillNameById.get(row.id) ?? row.id;
        return `Skill Category Skill Ranks: no weapon types are configured for ${skillName}.`;
      }

      if (weaponTypeOptions.length > 0 && !row.subcategory.trim()) {
        const skillName = skillNameById.get(row.id) ?? row.id;
        return `Skill Category Skill Ranks: select weapon type for ${skillName}.`;
      }

      if (weaponTypeOptions.length > 0 && row.subcategory.trim()) {
        const isValidWeaponType = weaponTypeOptions.some((opt) => opt.value === row.subcategory.trim());
        if (!isValidWeaponType) {
          const skillName = skillNameById.get(row.id) ?? row.id;
          return `Skill Category Skill Ranks: invalid weapon type selected for ${skillName}.`;
        }
      }

    }

    for (let choiceIndex = 0; choiceIndex < professionSkillDevelopmentChoiceDefinitions.length; choiceIndex++) {
      const choice = professionSkillDevelopmentChoiceDefinitions[choiceIndex];
      if (!choice) continue;
      const rows = professionSkillDevelopmentChoiceRows[choiceIndex] ?? [];
      const selectedKeys = new Set<string>();
      const selectedBySkill = new Map<string, { count: number; hasEmptySubcategory: boolean }>();
      for (let slot = 0; slot < choice.numChoices; slot++) {
        const row = rows[slot];
        if (!row?.id) {
          return `Profession Skill Development Types choice ${choiceIndex + 1}: select a skill for slot ${slot + 1}.`;
        }
        const isMandatorySubcategory = mandatorySubcategorySkillIds.has(row.id);
        const isLanguageSkill = languageSkillIds.has(row.id);
        const subcategory = row.subcategory.trim();
        if ((isMandatorySubcategory || isLanguageSkill) && !subcategory) {
          const skillName = skillNameById.get(row.id) ?? row.id;
          return isLanguageSkill
            ? `Profession Skill Development Types choice ${choiceIndex + 1}: select language for ${skillName}.`
            : `Profession Skill Development Types choice ${choiceIndex + 1}: enter subcategory for ${skillName}.`;
        }

        const key = `${row.id}::${subcategory.toLowerCase()}`;
        if (selectedKeys.has(key)) {
          const skillName = skillNameById.get(row.id) ?? row.id;
          return subcategory
            ? `Profession Skill Development Types choice ${choiceIndex + 1}: ${skillName} with subcategory '${subcategory}' is duplicated.`
            : `Profession Skill Development Types choice ${choiceIndex + 1}: ${skillName} is duplicated.`;
        }
        selectedKeys.add(key);

        const entry = selectedBySkill.get(row.id) ?? { count: 0, hasEmptySubcategory: false };
        entry.count += 1;
        entry.hasEmptySubcategory = entry.hasEmptySubcategory || !subcategory;
        selectedBySkill.set(row.id, entry);
      }

      for (const [skillId, entry] of selectedBySkill) {
        if (entry.count > 1 && entry.hasEmptySubcategory) {
          const skillName = skillNameById.get(skillId) ?? skillId;
          return `Profession Skill Development Types choice ${choiceIndex + 1}: ${skillName} cannot be selected more than once unless each selection has a subcategory.`;
        }
      }
    }

    for (let choiceIndex = 0; choiceIndex < professionCategoryDevelopmentChoiceDefinitions.length; choiceIndex++) {
      const choice = professionCategoryDevelopmentChoiceDefinitions[choiceIndex];
      if (!choice) continue;
      const rows = professionCategoryDevelopmentChoiceRows[choiceIndex] ?? [];
      const selectedKeys = new Set<string>();
      const selectedBySkill = new Map<string, { count: number; hasEmptySubcategory: boolean }>();
      for (let slot = 0; slot < choice.numChoices; slot++) {
        const row = rows[slot];
        if (!row?.id) {
          return `Profession Category Skill Development Types choice ${choiceIndex + 1}: select a skill for slot ${slot + 1}.`;
        }
        const isMandatorySubcategory = mandatorySubcategorySkillIds.has(row.id);
        const isLanguageSkill = languageSkillIds.has(row.id);
        const subcategory = row.subcategory.trim();
        if ((isMandatorySubcategory || isLanguageSkill) && !subcategory) {
          const skillName = skillNameById.get(row.id) ?? row.id;
          return isLanguageSkill
            ? `Profession Category Skill Development Types choice ${choiceIndex + 1}: select language for ${skillName}.`
            : `Profession Category Skill Development Types choice ${choiceIndex + 1}: enter subcategory for ${skillName}.`;
        }

        const key = `${row.id}::${subcategory.toLowerCase()}`;
        if (selectedKeys.has(key)) {
          const skillName = skillNameById.get(row.id) ?? row.id;
          return `Profession Category Skill Development Types choice ${choiceIndex + 1}: ${skillName} with subcategory '${subcategory}' is duplicated.`;
        }
        selectedKeys.add(key);

        const entry = selectedBySkill.get(row.id) ?? { count: 0, hasEmptySubcategory: false };
        entry.count += 1;
        entry.hasEmptySubcategory = entry.hasEmptySubcategory || !subcategory;
        selectedBySkill.set(row.id, entry);
      }

      for (const [skillId, entry] of selectedBySkill) {
        if (entry.count > 1 && entry.hasEmptySubcategory) {
          const skillName = skillNameById.get(skillId) ?? skillId;
          return `Profession Category Skill Development Types choice ${choiceIndex + 1}: ${skillName} cannot be selected more than once unless each selection has a subcategory.`;
        }
      }
    }

    for (let choiceIndex = 0; choiceIndex < professionGroupDevelopmentChoiceDefinitions.length; choiceIndex++) {
      const choice = professionGroupDevelopmentChoiceDefinitions[choiceIndex];
      if (!choice) continue;
      const rows = professionGroupDevelopmentChoiceRows[choiceIndex] ?? [];
      const selectedKeys = new Set<string>();
      const selectedBySkill = new Map<string, { count: number; hasEmptySubcategory: boolean }>();
      for (let slot = 0; slot < choice.numChoices; slot++) {
        const row = rows[slot];
        if (!row?.id) {
          return `Profession Group Skill Development Types choice ${choiceIndex + 1}: select a skill for slot ${slot + 1}.`;
        }
        const isMandatorySubcategory = mandatorySubcategorySkillIds.has(row.id);
        const isLanguageSkill = languageSkillIds.has(row.id);
        const subcategory = row.subcategory.trim();
        if ((isMandatorySubcategory || isLanguageSkill) && !subcategory) {
          const skillName = skillNameById.get(row.id) ?? row.id;
          return isLanguageSkill
            ? `Profession Group Skill Development Types choice ${choiceIndex + 1}: select language for ${skillName}.`
            : `Profession Group Skill Development Types choice ${choiceIndex + 1}: enter subcategory for ${skillName}.`;
        }

        const key = `${row.id}::${subcategory.toLowerCase()}`;
        if (selectedKeys.has(key)) {
          const skillName = skillNameById.get(row.id) ?? row.id;
          return subcategory
            ? `Profession Group Skill Development Types choice ${choiceIndex + 1}: ${skillName} with subcategory '${subcategory}' is duplicated.`
            : `Profession Group Skill Development Types choice ${choiceIndex + 1}: ${skillName} is duplicated.`;
        }
        selectedKeys.add(key);

        const entry = selectedBySkill.get(row.id) ?? { count: 0, hasEmptySubcategory: false };
        entry.count += 1;
        entry.hasEmptySubcategory = entry.hasEmptySubcategory || !subcategory;
        selectedBySkill.set(row.id, entry);
      }

      for (const [skillId, entry] of selectedBySkill) {
        if (entry.count > 1 && entry.hasEmptySubcategory) {
          const skillName = skillNameById.get(skillId) ?? skillId;
          return `Profession Group Skill Development Types choice ${choiceIndex + 1}: ${skillName} cannot be selected more than once unless each selection has a subcategory.`;
        }
      }
    }

    const selectedSpellListIds = new Set<string>();
    for (let choiceIndex = 0; choiceIndex < professionBaseSpellListChoiceDefinitions.length; choiceIndex++) {
      const choice = professionBaseSpellListChoiceDefinitions[choiceIndex];
      if (!choice) continue;

      const rows = professionBaseSpellListChoiceRows[choiceIndex] ?? [];
      for (let slot = 0; slot < choice.numChoices; slot++) {
        const spellListId = rows[slot] ?? '';
        if (!spellListId) {
          return `Profession Base Spell Lists choice ${choiceIndex + 1}: select spell list for slot ${slot + 1}.`;
        }
        if (selectedSpellListIds.has(spellListId)) {
          const spellListName = spellListNameById.get(spellListId) ?? spellListId;
          return `Profession Base Spell Lists: ${spellListName} can only be selected once.`;
        }
        selectedSpellListIds.add(spellListId);
      }
    }

    if (profession?.spellUserType === 'Pure') {
      const pureGroupIndex = professionBaseSpellListChoiceDefinitions.length;
      const pureRows = professionBaseSpellListChoiceRows[pureGroupIndex] ?? [];
      const pureOptionIds = new Set(pureExtraSpellListOptions.map((o) => o.value));
      for (let slot = 0; slot < PURE_EXTRA_SPELL_LIST_COUNT; slot++) {
        const spellListId = pureRows[slot] ?? '';
        if (!spellListId) {
          return `Pure Spell User Extra Lists: select spell list for slot ${slot + 1}.`;
        }
        if (!pureOptionIds.has(spellListId)) {
          return `Pure Spell User Extra Lists: invalid spell list in slot ${slot + 1}.`;
        }
        if (selectedSpellListIds.has(spellListId)) {
          const spellListName = spellListNameById.get(spellListId) ?? spellListId;
          return `Pure Spell User Extra Lists: ${spellListName} can only be selected once.`;
        }
        selectedSpellListIds.add(spellListId);
      }
    }

    if (professionWeaponCategoryCostDefinitions.length > 0) {
      const selectedCategoryIds = new Set<string>();
      for (let i = 0; i < professionWeaponCategoryCostDefinitions.length; i++) {
        const selectedCategory = professionWeaponCategoryCostSelections[i] ?? '';
        const definition = professionWeaponCategoryCostDefinitions[i];
        if (!definition) continue;
        if (!selectedCategory) {
          return `Allocate Weapon Costs row ${i + 1}: select a weapon skill category.`;
        }
        if (selectedCategoryIds.has(selectedCategory)) {
          const categoryName = categoryNameById.get(selectedCategory) ?? selectedCategory;
          return `Allocate Weapon Costs: ${categoryName} can only be selected once.`;
        }
        selectedCategoryIds.add(selectedCategory);
      }
    }

    return undefined;
  };

  const validateStats = (): string | undefined => {
    if (!statRollsLocked) {
      return 'Get potentials before assigning rolls to stats.';
    }

    const assignedStats: Stat[] = [];

    for (const roll of statRolls) {
      const temp = roll.temporary;
      if (!isValidUnsignedInt(temp)) {
        return `Temporary value for roll ${roll.slot} must be an integer between 1 and 100.`;
      }
      const num = Number(temp);
      if (num < 1 || num > 100) {
        return `Temporary value for roll ${roll.slot} must be between 1 and 100.`;
      }
      if (roll.potential == null) {
        return `Potential value for roll ${roll.slot} has not been generated yet.`;
      }
      if (!roll.assignedStat) {
        return `Assign roll ${roll.slot} to a stat.`;
      }
      assignedStats.push(roll.assignedStat);
    }

    const uniqueAssigned = new Set(assignedStats);
    if (uniqueAssigned.size !== STATS.length) {
      return 'Each stat must receive exactly one generated roll.';
    }

    for (const stat of STATS) {
      if (!uniqueAssigned.has(stat)) {
        return `No generated roll has been assigned to ${stat}.`;
      }
    }
    return undefined;
  };

  const validateHobby = (): string | undefined => {
    if (hobbyRankSpent > hobbyRanksBudget) {
      return `Hobby ranks over-allocated by ${hobbyRankSpent - hobbyRanksBudget}.`;
    }

    if (hobbyRankRemaining > 0) {
      return `Spend all hobby ranks before continuing. Remaining: ${hobbyRankRemaining}.`;
    }

    if (languageRankSpent > languageRanksBudget) {
      return `Language ranks over-allocated by ${languageRankSpent - languageRanksBudget}.`;
    }

    if (languageRankRemaining > 0) {
      return `Spend all language ranks before continuing. Remaining: ${languageRankRemaining}.`;
    }

    if (spellListRanksBudget > 0 && !hobbySpellListId) {
      return 'Select a spell list for hobby spell list ranks.';
    }

    const missingMandatorySubcategory = hobbySkillRows.find((row) => (
      mandatorySubcategorySkillIds.has(row.id)
      && row.value > row.base
      && !row.subcategory?.trim()
    ));

    if (missingMandatorySubcategory) {
      const skillLabel = skillNameById.get(missingMandatorySubcategory.id) ?? missingMandatorySubcategory.id;
      return `Enter a subcategory for ${skillLabel}.`;
    }

    return undefined;
  };

  const validateBackground = (): string | undefined => {
    if (backgroundBudget === 0) return undefined;
    if (selectedBackgroundPoints !== backgroundBudget) {
      return `Select exactly ${backgroundBudget} background options.`;
    }

    for (let rowIdx = 0; rowIdx < backgroundSkillBonusRows.length; rowIdx++) {
      const row = backgroundSkillBonusRows[rowIdx];
      if (!row) continue;
      const skillName = skillNameById.get(row.id) ?? row.id;
      const isWeaponGroupSkill = weaponGroupSkillIds.has(row.id);
      const weaponTypeOptions = weaponTypeOptionsBySkillId.get(row.id) ?? [];

      if (isWeaponGroupSkill && weaponTypeOptions.length === 0) {
        return `Background Skill Bonus: no weapon types are configured for ${skillName}.`;
      }

      if (isWeaponGroupSkill && !row.subcategory.trim()) {
        return `Background Skill Bonus: select weapon type for ${skillName}.`;
      }

      if (isWeaponGroupSkill && row.subcategory.trim()) {
        const isValidWeaponType = weaponTypeOptions.some((opt) => opt.value === row.subcategory.trim());
        if (!isValidWeaponType) {
          return `Background Skill Bonus: invalid weapon type selected for ${skillName}.`;
        }
      }

      if (!isWeaponGroupSkill && mandatorySubcategorySkillIds.has(row.id) && !row.subcategory.trim()) {
        return `Background Skill Bonus: enter subcategory for ${skillName}.`;
      }

      const isDuplicate = backgroundSkillBonusRows.slice(0, rowIdx).some(
        (other) => other.id === row.id && other.subcategory === row.subcategory,
      );
      if (isDuplicate) {
        return `Background Skill Bonus: duplicate selection for ${skillName} — choose a different subcategory.`;
      }
    }

    if (backgroundExtraLanguages && backgroundLanguageRankSpent > backgroundLanguageRanksBudget) {
      return `Background language ranks are over-allocated by ${backgroundLanguageRankSpent - backgroundLanguageRanksBudget}.`;
    }
    if (backgroundExtraLanguages && backgroundLanguageRankRemaining > 0) {
      return `Spend all extra language ranks before continuing. Remaining: ${backgroundLanguageRankRemaining}.`;
    }
    return undefined;
  };

  const validateApprenticeship = (): string | undefined => {
    if (apprenticeTotalDpSpent > characterBuilder.developmentPoints) {
      return `Development points overspent by ${apprenticeTotalDpSpent - characterBuilder.developmentPoints}.`;
    }

    // Require all TP choices to be resolved before completing apprenticeship
    if (tpsRequiringResolution.length > 0 && apprenticeSubstep !== 'purchasing') {
      return 'Resolve all training package choices before completing apprenticeship.';
    }
    for (const tp of tpsRequiringResolution) {
      const res = tpResolutions.find((r) => r.tpId === tp.id);
      if (!res) return `Training package choices not complete for ${tp.name}.`;
      const resError = validateTpResolution(tp, res);
      if (resError) return resError;
    }

    // Check only one lifestyle package selected
    let lifestyleCount = 0;
    for (const tpId of apprenticeTrainingPackageIds) {
      const tp = trainingPackages.find((t) => t.id === tpId);
      if (tp?.lifestyle) lifestyleCount++;
    }
    if (lifestyleCount > 1) return 'Only one lifestyle training package may be selected.';

    // Validate skill purchase subcategories
    for (const p of apprenticeSkillPurchases) {
      if (p.purchases <= 0) continue;
      const skillName = skillNameById.get(p.id) ?? p.id;
      const isWeaponGroupSkill = weaponGroupSkillIds.has(p.id);

      if (isWeaponGroupSkill && p.subcategory) {
        const validWeaponTypes = weaponTypeOptionsBySkillId.get(p.id) ?? [];
        if (!validWeaponTypes.some((wt) => wt.value === p.subcategory)) {
          return `Apprentice Skill: invalid weapon type selected for ${skillName}.`;
        }
      }

      if (!isWeaponGroupSkill && mandatorySubcategorySkillIds.has(p.id) && !p.subcategory.trim()) {
        return `Apprentice Skill: enter subcategory for ${skillName}.`;
      }

      if (isWeaponGroupSkill && mandatorySubcategorySkillIds.has(p.id) && !p.subcategory) {
        return `Apprentice Skill: select weapon type for ${skillName}.`;
      }
    }

    return undefined;
  };

  const validatePhysique = (): string | undefined => {
    if (!physiqueAutoHeight) {
      if (!physiqueEnteredHeightStr.trim()) return 'Enter height in inches or enable auto-generate.';
      if (!isValidUnsignedInt(physiqueEnteredHeightStr)) return 'Height must be a positive integer.';
      const h = Number(physiqueEnteredHeightStr);
      if (h <= 0) return 'Height must be a positive integer greater than zero.';
    }
    if (!physiqueAutoBuildMod) {
      if (physiqueEnteredBuildMod < -10 || physiqueEnteredBuildMod > 10) return 'Build modifier must be between -10 and 10.';
    }
    return undefined;
  };

  const recomputeErrors = () => {
    const next: StepErrors = {
      primary: validateInitial(),
      initial: validateInitialChoices(),
      stats: validateStats(),
      physique: validatePhysique(),
      hobby: validateHobby(),
      background: validateBackground(),
      apprenticeship: validateApprenticeship(),
    };
    setErrors(next);
    return next;
  };

  useEffect(() => {
    recomputeErrors();
  }, [
    raceId,
    characterName,
    cultureTypeId,
    cultureId,
    professionId,
    selectedRealms,
    raceEverymanChoiceRows,
    cultureTypeCategorySkillRankRows,
    professionSkillDevelopmentChoiceRows,
    professionCategoryDevelopmentChoiceRows,
    professionGroupDevelopmentChoiceRows,
    professionBaseSpellListChoiceRows,
    professionWeaponCategoryCostSelections,
    raceEverymanChoiceDefinitions,
    cultureTypeCategorySkillRankDefinitions,
    professionSkillDevelopmentChoiceDefinitions,
    professionCategoryDevelopmentChoiceDefinitions,
    professionGroupDevelopmentChoiceDefinitions,
    professionBaseSpellListChoiceDefinitions,
    professionWeaponCategoryCostDefinitions,
    mandatorySubcategorySkillIds,
    weaponTypeOptionsBySkillId,
    languageSkillIds,
    skillNameById,
    categoryNameById,
    weaponTypeNameById,
    spellListNameById,
    statRolls,
    statRollsLocked,
    physiqueAutoHeight,
    physiqueEnteredHeightStr,
    physiqueAutoBuildMod,
    physiqueEnteredBuildMod,
    hobbyRankSpent,
    hobbyRanksBudget,
    languageRankSpent,
    languageRanksBudget,
    spellListRanksBudget,
    hobbySpellListId,
    hobbySkillRows,
    selectedBackgroundPoints,
    backgroundSkillBonusRows,
    weaponGroupSkillIds,
    backgroundExtraLanguages,
    backgroundLanguageRankSpent,
    backgroundLanguageRanksBudget,
    backgroundLanguageRankRemaining,
    apprenticeTrainingPackageIds,
    apprenticeStatGains,
    apprenticeSkillPurchases,
    apprenticeCategoryPurchases,
    apprenticeSpellListPurchases,
    apprenticeTotalDpSpent,
    apprenticeSubstep,
    tpResolutions,
  ]);

  const canGoNext = (() => {
    if (step === 'summary') return false;
    const e = errors[step];
    return !e;
  })();

  const showPostPrimarySummary = STEP_ORDER.indexOf(step) > STEP_ORDER.indexOf('primary');
  const postPrimarySummaryValue = `${race?.name ?? ''} - ${profession?.name ?? ''} (${characterBuilder.id || ''})`.trim();

  const goPrev = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx <= 0) return;
    const prev = STEP_ORDER[idx - 1];
    if (prev) setStep(prev);
  };

  const buildBackgroundChoicesRequest = (builderId: string): SetCharacterBackgroundChoicesRequest => {
    const backgroundLanguages = backgroundState.extraLanguages
      ? backgroundState.languageRows
        .filter((row) => row.spoken > 0 || row.written > 0 || row.somatic > 0)
        .map((row) => ({
          language: row.language,
          ...(row.spoken > 0 ? { spoken: row.spoken } : {}),
          ...(row.written > 0 ? { written: row.written } : {}),
          ...(row.somatic > 0 ? { somatic: row.somatic } : {}),
        }))
      : [];

    const backgroundSkillBonus = backgroundState.skillBonuses.map((row) => ({
      id: row.id,
      subcategory: row.subcategory.trim() || undefined,
      value: 10,
    }));

    const backgroundCategoryBonus = backgroundState.categoryBonusIds.map((id) => ({
      id,
      value: 5,
    }));

    return {
      id: builderId,
      statGains: backgroundState.extraStatGainRolls,
      extraMoney: backgroundState.extraMoneyPoints as 0 | 1 | 2,
      backgroundLanguages,
      backgroundSkillBonus,
      backgroundCategoryBonus,
      backgroundItemCount: backgroundState.specialItemsPoints as 0 | 1 | 2,
    };
  };

  const goNext = async () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < 0 || idx >= STEP_ORDER.length - 1) return;
    if (!canGoNext) return;

    if (step === 'primary') {
      setSavingPrimaryDefinition(true);
      try {
        const response = await setPrimaryDefinition({
          ...characterBuilder,
          name: characterName.trim(),
          race: raceId,
          culture: cultureId,
          profession: professionId,
          magicalRealms: selectedRealms,
        });

        if (!response.id) {
          throw new Error('Primary definition response did not include a builder id.');
        }

        setCharacterBuilder(response);
      } catch (e) {
        toast({
          variant: 'danger',
          title: 'Save primary definition failed',
          description: String(e instanceof Error ? e.message : e),
        });
        return;
      } finally {
        setSavingPrimaryDefinition(false);
      }
    }

    if (step === 'initial') {
      if (!characterBuilder.id) {
        toast({
          variant: 'danger',
          title: 'Save initial choices failed',
          description: 'Character builder id is missing. Complete primary definition first.',
        });
        return;
      }

      setSavingInitialChoices(true);
      try {
        const response = await setCharacterPrimaryChoices(characterBuilder);
        setCharacterBuilder(response);
      } catch (e) {
        toast({
          variant: 'danger',
          title: 'Save initial choices failed',
          description: String(e instanceof Error ? e.message : e),
        });
        return;
      } finally {
        setSavingInitialChoices(false);
      }
    }

    if (step === 'stats') {
      if (!characterBuilder.id) {
        toast({
          variant: 'danger',
          title: 'Save stats failed',
          description: 'Character builder id is missing. Complete primary definition first.',
        });
        return;
      }

      setSavingStats(true);
      try {
        const initialStats = STATS.map((stat) => {
          const assigned = statRolls.find((roll) => roll.assignedStat === stat);
          if (!assigned) {
            throw new Error(`Missing assigned roll for stat ${stat}.`);
          }

          return {
            stat,
            temporary: Number(assigned.temporary) || 0,
            potential: assigned.potential ?? 0,
            racialBonus: (race?.statBonuses.find((b) => b.id === stat)?.value ?? 0)
              + apprenticeStatGains.filter((s) => s === stat).length,
          };
        });

        const statsResponse = await setCharacterStats({
          ...characterBuilder,
          initialStats,
        });
        setCharacterBuilder(statsResponse);

        const builderAfterStats = statsResponse ?? characterBuilder;

        const baseSkillByKey = new Map<string, number>();
        for (const row of builderAfterStats.skillRanks ?? []) {
          const key = skillChoiceKey(row.id, row.subcategory);
          baseSkillByKey.set(key, (baseSkillByKey.get(key) ?? 0) + (row.value ?? 0));
        }

        const baseCategoryById = new Map<string, number>();
        for (const row of builderAfterStats.categoryRanks ?? []) {
          baseCategoryById.set(row.id, (baseCategoryById.get(row.id) ?? 0) + (row.value ?? 0));
        }

        const baseLanguageById = new Map<string, { spoken: number; written: number; somatic: number }>();
        for (const row of builderAfterStats.languageAbilities ?? []) {
          baseLanguageById.set(row.language, {
            spoken: row.spoken ?? 0,
            written: row.written ?? 0,
            somatic: row.somatic ?? 0,
          });
        }

        const hobbySkillInit = (builderAfterStats.hobbySkillRankChoices ?? []).map((row) => {
          const key = skillChoiceKey(row.id, row.subcategory);
          const base = baseSkillByKey.get(key) ?? 0;
          const max = base + Math.max(0, row.value ?? 0);
          const prepopulatedSubcategory = row.subcategory?.trim();
          return {
            id: row.id,
            subcategory: prepopulatedSubcategory || undefined,
            subcategoryLocked: Boolean(prepopulatedSubcategory),
            base,
            max,
            value: base,
          };
        });

        const hobbyCategoryInit = (builderAfterStats.hobbyCategoryRankChoices ?? []).map((row) => {
          const rowId = String(row.id);
          const base = baseCategoryById.get(rowId) ?? 0;
          const max = base + Math.max(0, row.value ?? 0);
          return {
            id: rowId,
            base,
            max,
            value: base,
          };
        });

        const hobbyLanguageInit = (race?.adolescentLanguages ?? []).map((row) => {
          const base = baseLanguageById.get(row.language);
          const baseSpoken = base?.spoken ?? 0;
          const baseWritten = base?.written ?? 0;
          const baseSomatic = base?.somatic ?? 0;
          const maxSpoken = Math.max(baseSpoken, row.spoken ?? 0);
          const maxWritten = Math.max(baseWritten, row.written ?? 0);
          const maxSomatic = Math.max(baseSomatic, row.somatic ?? 0);
          return {
            language: row.language,
            baseSpoken,
            baseWritten,
            baseSomatic,
            maxSpoken,
            maxWritten,
            maxSomatic,
            spoken: baseSpoken,
            written: baseWritten,
            somatic: baseSomatic,
          };
        });

        const spellListOptions = (
          builderAfterStats.categorySpellLists
            .find((row) => row.category === OWN_REALM_OPEN_LISTS_CATEGORY_ID)
            ?.spellLists ?? []
        ).map((x) => String(x));
        const spellListRankBudget = Math.max(
          0,
          builderAfterStats.numAdolescentSpellListRanks
          ?? cultureType?.spellListRanks
          ?? 0,
        );
        const existingSpellListId = spellListRankBudget > 0
          ? (builderAfterStats.adolescentSpellListChoice ?? '')
          : '';
        const spellListSelection = spellListRankBudget > 0
          ? (spellListOptions.includes(existingSpellListId) ? existingSpellListId : '')
          : '';

        setHobbyRanksBudget(Math.max(
          0,
          builderAfterStats.numHobbySkillRanks
          ?? cultureType?.hobbySkillRanks
          ?? 0,
        ));
        setHobbySkillRows(hobbySkillInit);
        setHobbyCategoryRows(hobbyCategoryInit);

        setLanguageRanksBudget(Math.max(
          0,
          builderAfterStats.numAdolescentLanguageRanks
          ?? cultureType?.adolescentLanguageRanks
          ?? 0,
        ));
        setHobbyLanguageRows(hobbyLanguageInit);

        setSpellListRanksBudget(spellListRankBudget);
        setHobbySpellListOptions(spellListOptions);
        setHobbySpellListId(spellListSelection);
      } catch (e) {
        toast({
          variant: 'danger',
          title: 'Save stats failed',
          description: String(e instanceof Error ? e.message : e),
        });
        return;
      } finally {
        setSavingStats(false);
      }
    }

    if (step === 'physique') {
      if (!characterBuilder.id) {
        toast({
          variant: 'danger',
          title: 'Save physique failed',
          description: 'Character builder id is missing. Complete primary definition first.',
        });
        return;
      }

      setSavingPhysique(true);
      try {
        const heightValue = physiqueAutoHeight ? null : (Number(physiqueEnteredHeightStr) || null);
        const buildModValue = physiqueAutoBuildMod ? null : physiqueEnteredBuildMod;

        const response = await setCharacterPhysique({
          ...characterBuilder,
          male: isMale,
          autoHeight: physiqueAutoHeight,
          enteredHeight: heightValue,
          autoBuildModifier: physiqueAutoBuildMod,
          enteredBuildModifier: buildModValue,
        });
        setCharacterBuilder(response);
      } catch (e) {
        toast({
          variant: 'danger',
          title: 'Save physique failed',
          description: String(e instanceof Error ? e.message : e),
        });
        return;
      } finally {
        setSavingPhysique(false);
      }
    }

    if (step === 'hobby') {
      if (!characterBuilder.id) {
        toast({
          variant: 'danger',
          title: 'Save hobby choices failed',
          description: 'Character builder id is missing. Complete primary definition first.',
        });
        return;
      }

      setSavingHobbyChoices(true);
      try {
        const hobbySkillRanks = hobbySkillRows
          .map((row) => ({
            id: row.id,
            subcategory: row.subcategory,
            value: Math.max(0, row.value - row.base),
          }))
          .filter((row) => row.value > 0);

        const hobbyCategoryRanks = hobbyCategoryRows
          .map((row) => ({
            id: row.id,
            value: Math.max(0, row.value - row.base),
          }))
          .filter((row) => row.value > 0);

        const adolescentLanguageChoices = hobbyLanguageRows
          .filter((row) => row.spoken > row.baseSpoken || row.written > row.baseWritten || row.somatic > row.baseSomatic)
          .map((row) => ({
            language: row.language,
            ...(row.spoken > 0 ? { spoken: row.spoken } : {}),
            ...(row.written > 0 ? { written: row.written } : {}),
            ...(row.somatic > 0 ? { somatic: row.somatic } : {}),
          }));

        const response = await setCharacterHobbyChoices({
          ...characterBuilder,
          hobbySkillRanks,
          hobbyCategoryRanks,
          adolescentLanguageChoices,
          adolescentSpellListChoice: hobbySpellListId || null,
        });

        setCharacterBuilder(response);
      } catch (e) {
        toast({
          variant: 'danger',
          title: 'Save hobby choices failed',
          description: String(e instanceof Error ? e.message : e),
        });
        return;
      } finally {
        setSavingHobbyChoices(false);
      }
    }

    if (step === 'background') {
      if (!characterBuilder.id) {
        toast({
          variant: 'danger',
          title: 'Save background choices failed',
          description: 'Character builder id is missing. Complete primary definition first.',
        });
        return;
      }

      setSavingBackgroundChoices(true);
      try {
        const response = await setCharacterBackgroundChoices(
          buildBackgroundChoicesRequest(characterBuilder.id),
        );

        setCharacterBuilder(response);
        setPreApprenticeshipRanks({
          skillRanks: response.skillRanks ?? [],
          categoryRanks: response.categoryRanks ?? [],
          spellListRanks: response.spellListRanks ?? [],
        });
      } catch (e) {
        toast({
          variant: 'danger',
          title: 'Save background choices failed',
          description: String(e instanceof Error ? e.message : e),
        });
        return;
      } finally {
        setSavingBackgroundChoices(false);
      }
    }

    const next = STEP_ORDER[idx + 1];
    if (next) setStep(next);
  };

  const generateAllTemporary = () => {
    if (statRollsLocked) return;
    setStatRolls((prev) => sortRollsDescending(prev.map((roll) => ({
      ...roll,
      temporary: String(rollTemporaryValue()),
      potential: null,
    }))));
  };

  const onChangeTemporaryRoll = (slot: number, value: string) => {
    if (statRollsLocked) return;
    const next = sanitizeUnsignedInt(value);
    setStatRolls((prev) => prev.map((roll) =>
      roll.slot === slot ? { ...roll, temporary: next, potential: null } : roll
    ));
  };

  const getPotentials = async () => {
    if (!raceId || !cultureId || !professionId || selectedRealms.length === 0) return;

    for (const roll of statRolls) {
      if (roll.temporary) {
        if (!isValidUnsignedInt(roll.temporary)) {
          toast({ variant: 'warning', title: 'Invalid temporary value', description: `Roll ${roll.slot} temporary must be an integer between 25 and 100.` });
          return;
        }
        const value = Number(roll.temporary);
        if (value < 25 || value > 100) {
          toast({ variant: 'warning', title: 'Invalid temporary value', description: `Roll ${roll.slot} temporary must be between 25 and 100.` });
          return;
        }
      }

    }

    setGeneratingStats(true);
    try {
      const payload = statRolls.map((roll) => ({
        temporary: roll.temporary ? Number(roll.temporary) : -1,
      }));

      const response = await getStatRollPotentials(payload);

      if (!Array.isArray(response) || response.length !== STATS.length) {
        throw new Error(`Expected ${STATS.length} stat roll results from server.`);
      }

      const next = response.map((result, index) => ({
        slot: index + 1,
        temporary: String(result.temporary),
        potential: result.potential,
        assignedStat: statRolls[index]?.assignedStat ?? '',
      } satisfies StatRoll));

      setStatRolls(sortRollsDescending(next));
      setStatRollsLocked(true);

      toast({ variant: 'success', title: 'Potentials generated', description: 'Stat rolls are now locked and ready for stat assignment.' });
    } catch (e) {
      toast({
        variant: 'danger',
        title: 'Get potentials failed',
        description: String(e instanceof Error ? e.message : e),
      });
    } finally {
      setGeneratingStats(false);
    }
  };

  const updateGroupedSkillChoiceRow = (
    setter: Dispatch<SetStateAction<SkillChoiceRow[][]>>,
    groupIndex: number,
    rowIndex: number,
    patch: Partial<SkillChoiceRow>,
  ) => {
    setter((prev) => prev.map((group, gIdx) => {
      if (gIdx !== groupIndex) return group;
      return group.map((row, rIdx) => {
        if (rIdx !== rowIndex) return row;
        return {
          ...row,
          ...patch,
        };
      });
    }));
  };

  const updateFlatSkillChoiceRow = (
    setter: Dispatch<SetStateAction<SkillChoiceRow[]>>,
    rowIndex: number,
    patch: Partial<SkillChoiceRow>,
  ) => {
    setter((prev) => prev.map((row, idx) => {
      if (idx !== rowIndex) return row;
      return {
        ...row,
        ...patch,
      };
    }));
  };

  const updateBaseSpellListChoiceRow = (
    groupIndex: number,
    rowIndex: number,
    value: string,
  ) => {
    setProfessionBaseSpellListChoiceRows((prev) => prev.map((group, gIdx) => {
      if (gIdx !== groupIndex) return group;
      return group.map((existing, rIdx) => (rIdx === rowIndex ? value : existing));
    }));
  };

  const canSpendBackgroundPoints = (cost: number): boolean => selectedBackgroundPoints + cost <= backgroundBudget;

  const backgroundActions = {
    toggleExtraStatGainRolls(checked: boolean) {
      if (!checked) {
        setBackgroundExtraStatGainRolls(false);
        return;
      }
      if (!canSpendBackgroundPoints(1)) return;
      setBackgroundExtraStatGainRolls(true);
    },

    decrementExtraMoneyPoints() {
      setBackgroundExtraMoneyPoints((v) => Math.max(0, v - 1));
    },

    incrementExtraMoneyPoints() {
      if (backgroundExtraMoneyPoints >= 2) return;
      if (!canSpendBackgroundPoints(1)) return;
      setBackgroundExtraMoneyPoints((v) => v + 1);
    },

    toggleExtraLanguages(checked: boolean) {
      if (!checked) {
        setBackgroundExtraLanguages(false);
        return;
      }
      if (!canSpendBackgroundPoints(1)) return;
      setBackgroundExtraLanguages(true);
    },

    addSkillBonus(id: string) {
      if (!id) return;
      const hasSubcategorySupport = (weaponTypeOptionsBySkillId.get(id) ?? []).length > 0 || mandatorySubcategorySkillIds.has(id);
      if (!hasSubcategorySupport && selectedBackgroundSkillSet.has(id)) return;
      if (!canSpendBackgroundPoints(1)) return;
      if (hasSubcategorySupport) {
        setBackgroundSkillPendingId(id);
        setBackgroundSkillPendingSubcategory('');
      } else {
        setBackgroundSkillBonusRows((prev) => [...prev, { id, subcategory: '' }]);
      }
    },

    confirmSkillBonusPending() {
      if (!backgroundSkillPendingId) return;
      setBackgroundSkillBonusRows((prev) => [...prev, { id: backgroundSkillPendingId, subcategory: backgroundSkillPendingSubcategory.trim() }]);
      setBackgroundSkillPendingId('');
      setBackgroundSkillPendingSubcategory('');
    },

    cancelSkillBonusPending() {
      setBackgroundSkillPendingId('');
      setBackgroundSkillPendingSubcategory('');
    },

    removeSkillBonus(index: number) {
      setBackgroundSkillBonusRows((prev) => prev.filter((_, i) => i !== index));
    },

    updateSkillBonusSubcategory(index: number, subcategory: string) {
      setBackgroundSkillBonusRows((prev) => prev.map((row, i) => (
        i === index ? { ...row, subcategory } : row
      )));
    },

    addCategoryBonus(id: string) {
      if (!id) return;
      if (selectedBackgroundCategorySet.has(id)) return;
      if (!canSpendBackgroundPoints(1)) return;
      setBackgroundCategoryBonusIds((prev) => [...prev, id]);
    },

    removeCategoryBonus(id: string) {
      setBackgroundCategoryBonusIds((prev) => prev.filter((x) => x !== id));
    },

    decrementSpecialItemsPoints() {
      setBackgroundSpecialItemsPoints((v) => Math.max(0, v - 1));
    },

    incrementSpecialItemsPoints() {
      if (backgroundSpecialItemsPoints >= 2) return;
      if (!canSpendBackgroundPoints(1)) return;
      setBackgroundSpecialItemsPoints((v) => v + 1);
    },
  };

  const updateBackgroundLanguageRank = (
    rowIndex: number,
    key: 'spoken' | 'written' | 'somatic',
    delta: 1 | -1,
  ) => {
    setBackgroundLanguageRows((prev) => {
      const target = prev[rowIndex];
      if (!target) return prev;

      const currentValue = target[key];
      const maxValue = key === 'spoken' ? target.maxSpoken : key === 'written' ? target.maxWritten : target.maxSomatic;
      const baseValue = key === 'spoken' ? target.baseSpoken : key === 'written' ? target.baseWritten : target.baseSomatic;
      const nextValue = currentValue + delta;

      if (delta > 0) {
        if (backgroundLanguageRankRemaining <= 0) return prev;
        if (nextValue > maxValue) return prev;
      }

      if (delta < 0 && nextValue < baseValue) return prev;

      const copy = prev.slice();
      copy[rowIndex] = { ...target, [key]: nextValue };
      return copy;
    });
  };

  const resetBackgroundState = () => {
    const reset = createEmptyBackgroundOptionState();
    setBackgroundExtraStatGainRolls(reset.extraStatGainRolls);
    setBackgroundExtraMoneyPoints(reset.extraMoneyPoints);
    setBackgroundExtraLanguages(reset.extraLanguages);
    setBackgroundLanguageRows(reset.languageRows);
    setBackgroundSkillBonusRows(reset.skillBonuses);
    setBackgroundSkillCategoryFilter('');
    setBackgroundSkillPendingId('');
    setBackgroundSkillPendingSubcategory('');
    setBackgroundCategoryBonusIds(reset.categoryBonusIds);
    setBackgroundSpecialItemsPoints(reset.specialItemsPoints);
  };

  const backgroundOptionCardShellStyle = {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 10,
  };

  const resetWorkflow = () => {
    setStep('primary');
    setCharacterName('');
    setIsMale(true);
    setPhysiqueAutoHeight(true);
    setPhysiqueEnteredHeightStr('');
    setPhysiqueAutoBuildMod(true);
    setPhysiqueEnteredBuildMod(0);
    setRaceId('');
    setCultureTypeId('');
    setCultureId('');
    setProfessionId('');
    setSelectedRealms([]);
    setRaceEverymanChoiceRows([]);
    setCultureTypeCategorySkillRankRows([]);
    setProfessionSkillDevelopmentChoiceRows([]);
    setProfessionCategoryDevelopmentChoiceRows([]);
    setProfessionGroupDevelopmentChoiceRows([]);
    setProfessionBaseSpellListChoiceRows([]);
    setProfessionWeaponCategoryCostSelections([]);
    setStatRolls(createEmptyStatRolls());
    setStatRollsLocked(false);
    setHobbyRanksBudget(0);
    setHobbySkillRows([]);
    setHobbyCategoryRows([]);
    setLanguageRanksBudget(0);
    setHobbyLanguageRows([]);
    setSpellListRanksBudget(0);
    setHobbySpellListOptions([]);
    setHobbySpellListId('');
    resetBackgroundState();
    setApprenticeTrainingPackageIds([]);
    setApprenticeStatGains([]);
    setApprenticeSkillPurchases([]);
    setApprenticeSkillCategoryFilter('');
    setApprenticeSkillPendingId('');
    setApprenticeSkillPendingSubcategory('');
    setApprenticeCategoryPurchases([]);
    setApprenticeSpellListPurchases([]);
    setApprenticeSelectedSpellCategory('');
    setApprenticeAddingSpellList(false);
    setApprenticeSubstep('selecting');
    setApprenticeResolvingTpIndex(0);
    setTpResolutions([]);
    setPreApprenticeshipRanks({ skillRanks: [], categoryRanks: [], spellListRanks: [] });
    setCharacterBuilder(createEmptyCharacterBuilder());
    setErrors({});
  };

  const submitLevelUpgrade = async (): Promise<boolean> => {
    if (!raceId || !cultureId || !professionId || selectedRealms.length === 0) return false;

    const nextErrors = recomputeErrors();
    if (Object.values(nextErrors).some(Boolean)) {
      toast({
        variant: 'warning',
        title: 'Cannot apply level upgrade',
        description: 'Please resolve validation issues in earlier steps.',
      });
      return false;
    }

    setApplying(true);
    try {
      const totalStatGains: Stat[] = [];
      for (const tp of selectedApprenticeTrainingPackages) {
        for (const stat of tp.statGains ?? []) totalStatGains.push(stat);
        const res = tpResolutions.find((r) => r.tpId === tp.id);
        if (res) {
          for (const stat of res.statGainChoices) {
            if (stat) totalStatGains.push(stat);
          }
        }
      }
      totalStatGains.push(...apprenticeStatGains);

      const totalSkillsByKey = new Map<string, { id: string; subcategory?: string | undefined; ranks: number }>();
      const addSkillRanks = (id: string, subcategory: string | undefined, ranks: number) => {
        if (!id || ranks <= 0) return;
        const normalizedSubcategory = subcategory?.trim() || undefined;
        const key = skillChoiceKey(id, normalizedSubcategory);
        const existing = totalSkillsByKey.get(key);
        if (existing) {
          existing.ranks += ranks;
        } else {
          totalSkillsByKey.set(key, {
            id,
            ...(normalizedSubcategory ? { subcategory: normalizedSubcategory } : {}),
            ranks,
          });
        }
      };
      for (const rank of preApprenticeshipRanks.skillRanks ?? []) {
        addSkillRanks(rank.id, rank.subcategory, rank.value ?? 0);
      }
      for (const rank of characterBuilder.skillRanks ?? []) {
        addSkillRanks(rank.id, rank.subcategory, rank.value ?? 0);
      }

      const totalCategoryRanks = new Map<string, number>();
      const addCategoryRanks = (id: string, ranks: number) => {
        if (!id || ranks <= 0) return;
        totalCategoryRanks.set(id, (totalCategoryRanks.get(id) ?? 0) + ranks);
      };
      for (const rank of preApprenticeshipRanks.categoryRanks ?? []) {
        addCategoryRanks(rank.id, rank.value ?? 0);
      }
      for (const rank of characterBuilder.categoryRanks ?? []) {
        addCategoryRanks(rank.id, rank.value ?? 0);
      }

      const knownSpellListIds = new Set(spellLists.map((sl) => sl.id));
      const spellListTotals = new Map<string, number>();
      const spellListCategoryOverrides = new Map<string, string>();
      const addSpellListRanks = (spellListId: string, ranks: number) => {
        if (!spellListId || ranks <= 0 || !knownSpellListIds.has(spellListId)) return;
        spellListTotals.set(spellListId, (spellListTotals.get(spellListId) ?? 0) + ranks);
      };

      for (const rank of preApprenticeshipRanks.spellListRanks ?? []) {
        addSpellListRanks(rank.id, rank.value ?? 0);
      }

      for (const p of apprenticeSpellListPurchases) {
        if (p.purchases > 0) addSpellListRanks(p.id, p.purchases);
      }

      for (const tp of selectedApprenticeTrainingPackages) {
        const res = tpResolutions.find((r) => r.tpId === tp.id);

        const fixedSpellRows = (tp.spellListRanks ?? []).filter((r) => r.numChoices <= 0);
        for (const row of fixedSpellRows) {
          for (const spellListId of row.options ?? []) {
            addSpellListRanks(spellListId, row.value);
            if (row.optionalCategory?.trim()) {
              spellListCategoryOverrides.set(spellListId, row.optionalCategory.trim());
            }
          }
        }

        const choiceableSpellRows = (tp.spellListRanks ?? []).filter((r) => r.numChoices > 0);
        for (let gi = 0; gi < choiceableSpellRows.length; gi++) {
          const row = choiceableSpellRows[gi];
          if (!row) continue;
          const allocs = res?.spellListChoices[gi] ?? [];
          for (const alloc of allocs) {
            addSpellListRanks(alloc.id, alloc.ranks);
            if (alloc.id && row.optionalCategory?.trim()) {
              spellListCategoryOverrides.set(alloc.id, row.optionalCategory.trim());
            }
          }
        }

        for (let gi = 0; gi < (tp.spellListCategoryRankChoices ?? []).length; gi++) {
          const allocs = res?.spellListCategoryChoices[gi] ?? [];
          for (const alloc of allocs) {
            addSpellListRanks(alloc.id, alloc.ranks);
          }
        }
      }

      const totalLanguages = new Map<string, { language: string; spoken: number; written: number; somatic: number }>();
      const ensureLanguageRow = (languageId: string) => {
        let row = totalLanguages.get(languageId);
        if (!row) {
          row = { language: languageId, spoken: 0, written: 0, somatic: 0 };
          totalLanguages.set(languageId, row);
        }
        return row;
      };
      for (const row of characterBuilder.languageAbilities ?? []) {
        if (!row.language) continue;
        const target = ensureLanguageRow(row.language);
        target.spoken += Math.max(0, row.spoken ?? 0);
        target.written += Math.max(0, row.written ?? 0);
        target.somatic += Math.max(0, row.somatic ?? 0);
      }
      for (const res of tpResolutions) {
        for (const group of res.languageChoices ?? []) {
          for (const alloc of group ?? []) {
            if (!alloc.languageId) continue;
            const target = ensureLanguageRow(alloc.languageId);
            target.spoken += Math.max(0, alloc.spoken ?? 0);
            target.written += Math.max(0, alloc.written ?? 0);
            target.somatic += Math.max(0, alloc.somatic ?? 0);
          }
        }
      }

      const payload: CharacterBuilder = {
        ...characterBuilder,
        apprenticeshipTrainingPackages: apprenticeTrainingPackageIds,
        apprenticeshipStatGains: totalStatGains,
        skillRanks: Array.from(totalSkillsByKey.values())
          .filter((row) => row.ranks > 0)
          .sort((a, b) => skillChoiceKey(a.id, a.subcategory).localeCompare(skillChoiceKey(b.id, b.subcategory)))
          .map(({ id, subcategory, ranks }) => ({ id, ...(subcategory ? { subcategory } : {}), value: ranks })),
        categoryRanks: Array.from(totalCategoryRanks.entries())
          .filter(([, ranks]) => ranks > 0)
          .map(([id, ranks]) => ({ id, value: ranks }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        spellListRanks: Array.from(spellListTotals.entries())
          .filter(([, ranks]) => ranks > 0)
          .map(([id, ranks]) => ({ id, value: ranks }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        languageAbilities: Array.from(totalLanguages.values())
          .filter((row) => row.spoken > 0 || row.written > 0 || row.somatic > 0)
          .map((row) => ({
            language: row.language,
            ...(row.spoken > 0 ? { spoken: row.spoken } : {}),
            ...(row.written > 0 ? { written: row.written } : {}),
            ...(row.somatic > 0 ? { somatic: row.somatic } : {}),
          }))
          .sort((a, b) => a.language.localeCompare(b.language)),
      };

      const response = await applyApprenticeshipChoices(payload);
      setCharacterBuilder(response);
      toast({
        variant: 'success',
        title: 'Apprenticeship choices applied',
        description: 'Your character has been successfully built.',
      });
      return true;
    } catch (e) {
      toast({
        variant: 'danger',
        title: 'Apply apprenticeship choices failed',
        description: String(e instanceof Error ? e.message : e),
      });
      return false;
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div>Loading character workflow…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Character Creation</h2>
      {/* The form panel is shared across steps, with conditional rendering of step-specific inputs. */}
      <div className="form-panel" style={{ display: 'grid', gap: 14 }}>
        {showPostPrimarySummary && (
          <LabeledInput
            label="Character"
            hideLabel={true}
            value={postPrimarySummaryValue}
            onChange={() => { }}
            inputProps={{ readOnly: true }}
            disabled
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}>
          <input
            type="checkbox"
            id="show-descriptions"
            checked={showDescriptions}
            onChange={(e) => setShowDescriptions(e.target.checked)}
          />
          <label htmlFor="show-descriptions" style={{ fontSize: 14, cursor: 'pointer' }}>Show descriptions</label>
        </div>

        <div style={{ color: 'var(--muted)' }}>
          Complete each step in order. Progression is locked until the current step is valid.
        </div>

        {/* Step indicators with validation error tooltips and navigation control. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {STEP_ORDER.map((s, i) => {
            const active = s === step;
            const hasError = !!errors[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const targetIndex = STEP_ORDER.indexOf(s);
                  const currentIndex = STEP_ORDER.indexOf(step);
                  if (targetIndex <= currentIndex) setStep(s);
                }}
                disabled={STEP_ORDER.indexOf(s) > STEP_ORDER.indexOf(step)}
                style={{
                  border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: active ? 'var(--primary-weak)' : undefined,
                  opacity: STEP_ORDER.indexOf(s) > STEP_ORDER.indexOf(step) ? 0.65 : 1,
                }}
                title={hasError ? errors[s] : STEP_LABELS[s]}
              >
                {i + 1}
                {hasError ? ' ⚠' : ''}
              </button>
            );
          })}
        </div>

        {/* Form panels for each step. Only the active step is interactable, but previous steps are shown for context. */}
        <div className="form-container">
          {(generatingStats || applying || savingPrimaryDefinition || savingInitialChoices || savingStats || savingPhysique || savingHobbyChoices || savingBackgroundChoices) && (
            <div className="overlay">
              <Spinner size={24} />
              <span>
                {savingPrimaryDefinition
                  ? 'Saving primary definition…'
                  : savingInitialChoices
                    ? 'Saving initial choices…'
                    : savingStats
                      ? 'Saving stats…'
                      : savingPhysique
                        ? 'Saving physique…'
                        : savingHobbyChoices
                          ? 'Saving hobby choices…'
                          : savingBackgroundChoices
                            ? 'Saving background choices…'
                            : applying
                              ? 'Applying level upgrade…'
                              : 'Generating stats…'}
              </span>
            </div>
          )}

          <h3>{STEP_LABELS[step]}</h3>

          {step === 'primary' && (
            <section style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                <LabeledInput
                  label="Name"
                  value={characterName}
                  onChange={(v) => setCharacterName(v)}
                  placeholder="Character name"
                  error={errors.primary && !characterName.trim() ? 'Required' : undefined}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'flex-end', paddingBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Sex</span>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <CheckboxInput
                      label="Male"
                      checked={isMale}
                      onChange={(checked) => { if (checked) setIsMale(true); }}
                    />
                    <CheckboxInput
                      label="Female"
                      checked={!isMale}
                      onChange={(checked) => { if (checked) setIsMale(false); }}
                    />
                  </div>
                </div>

                <LabeledSelect
                  label="Race"
                  value={raceId}
                  onChange={(v) => {
                    setRaceId(v);
                    setApprenticeTrainingPackageIds([]);
                    resetBackgroundState();
                  }}
                  options={races
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((r) => ({ value: r.id, label: r.name }))}
                  error={errors.primary && !raceId ? 'Required' : undefined}
                />

                <LabeledSelect
                  label="Culture Type"
                  value={cultureTypeId}
                  onChange={(v) => {
                    setCultureTypeId(v);
                    setApprenticeTrainingPackageIds([]);
                    resetBackgroundState();
                  }}
                  options={cultureTypes
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((ct) => ({ value: ct.id, label: ct.name }))}
                  error={errors.primary && !cultureTypeId ? 'Required' : undefined}
                />

                <LabeledSelect
                  label="Culture"
                  value={cultureId}
                  onChange={(v) => {
                    setCultureId(v);
                    setApprenticeTrainingPackageIds([]);
                  }}
                  options={availableCultures
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => ({ value: c.id, label: c.name }))}
                  disabled={!cultureTypeId}
                  helperText={!cultureTypeId ? 'Select a Culture Type first.' : undefined}
                  error={errors.primary && !cultureId ? 'Required' : undefined}
                />

                <LabeledSelect
                  label="Profession"
                  value={professionId}
                  onChange={(v) => {
                    setProfessionId(v);
                    setSelectedRealms([]);
                    resetBackgroundState();
                  }}
                  options={professionOptions.map((o) => ({ ...o, title: showDescriptions ? o.description : undefined }))}
                  helperText={
                    culture
                      ? `Preferred: ${culture.preferredProfessions.length}, Restricted: ${culture.restrictedProfessions.length}`
                      : undefined
                  }
                  error={errors.primary && !professionId ? 'Required' : undefined}
                />

                {!requiresRealmSelection ? (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <span>Realms</span>
                    <div style={{ minHeight: 38, padding: 8, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--panel)' }}>
                      {selectedRealms.join(', ') || 'No predefined spell realms'}
                    </div>
                    <small style={{ color: 'var(--muted)' }}>Defined by profession. No selection allowed.</small>
                  </div>
                ) : (
                  <LabeledSelect
                    label="Realm"
                    value={selectedRealms[0] ?? ''}
                    onChange={(v) => setSelectedRealms(v ? [v as Realm] : [])}
                    options={realmOptionsForProfession}
                    disabled={!profession}
                    error={errors.primary && selectedRealms.length !== 1 ? 'Required' : undefined}
                  />
                )}
              </div>

              {errors.primary && (
                <div style={{ color: '#b00020' }}>{errors.primary}</div>
              )}
            </section>
          )}

          {step === 'initial' && (
            <section style={{ display: 'grid', gap: 12 }}>
              {raceEverymanChoiceDefinitions.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <h4 style={{ margin: 0 }}>Racial Everyman Skills</h4>
                  {raceEverymanChoiceDefinitions.map((choice, choiceIndex) => {
                    const optionList = raceEverymanSkillOptions[choiceIndex] ?? [];
                    const rows = raceEverymanChoiceRows[choiceIndex] ?? [];
                    return (
                      <div key={`race-everyman-${choiceIndex}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
                        <div style={{ color: 'var(--muted)' }}>
                          Choice #{choiceIndex + 1}: select {choice.numChoices} skill{choice.numChoices === 1 ? '' : 's'}.
                        </div>
                        {rows.map((row, rowIndex) => {
                          const otherRows = rows.filter((_, i) => i !== rowIndex);
                          const availableOptions = optionList.filter((opt) => {
                            const otherWithSameId = otherRows.filter((r) => r.id === opt.value);
                            if (otherWithSameId.length === 0) return true;
                            // Allow reselection if the skill supports subcategories (weapon or mandatory)
                            const weaponOpts = weaponTypeOptionsBySkillId.get(opt.value) ?? [];
                            const hasSubcategorySupport = weaponOpts.length > 0 || mandatorySubcategorySkillIds.has(opt.value);
                            return hasSubcategorySupport;
                          });
                          const weaponTypeOptions = row.id ? (weaponTypeOptionsBySkillId.get(row.id) ?? []) : [];
                          const isWeaponSkill = weaponTypeOptions.length > 0;
                          return (
                            <div key={`race-everyman-${choiceIndex}-${rowIndex}`} style={{ display: 'grid', gap: 6, gridTemplateColumns: 'minmax(260px, 1fr) minmax(220px, 1fr)' }}>
                              <RichSelect
                                label={`Skill ${rowIndex + 1}`}
                                value={row.id}
                                onChange={(value) => updateGroupedSkillChoiceRow(setRaceEverymanChoiceRows, choiceIndex, rowIndex, {
                                  id: value,
                                  subcategory: '',
                                })}
                                options={availableOptions}
                                placeholderOption="— Select skill —"
                              />
                              {row.id && isWeaponSkill ? (
                                <LabeledSelect
                                  label="Weapon Type"
                                  value={row.subcategory}
                                  onChange={(value) => updateGroupedSkillChoiceRow(setRaceEverymanChoiceRows, choiceIndex, rowIndex, {
                                    subcategory: value,
                                  })}
                                  options={weaponTypeOptions}
                                  placeholderOption="— Select weapon type —"
                                  error={errors.initial && !row.subcategory.trim() ? 'Required' : undefined}
                                />
                              ) : row.id && mandatorySubcategorySkillIds.has(row.id) ? (
                                <LabeledInput
                                  label="Subcategory"
                                  value={row.subcategory}
                                  onChange={(value) => updateGroupedSkillChoiceRow(setRaceEverymanChoiceRows, choiceIndex, rowIndex, {
                                    subcategory: value,
                                  })}
                                  placeholder="Enter subcategory"
                                  error={errors.initial && !row.subcategory.trim() ? 'Required' : undefined}
                                />
                              ) : (
                                <div />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              {cultureTypeCategorySkillRankDefinitions.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <h4 style={{ margin: 0 }}>Skill Category Skill Ranks</h4>
                  {cultureTypeCategorySkillRankDefinitions.map((def, index) => {
                    const row = cultureTypeCategorySkillRankRows[index] ?? createEmptySkillChoiceRow();
                    const optionList = cultureTypeCategorySkillOptions[index] ?? [];
                    const weaponTypeOptions = row.id ? (weaponTypeOptionsBySkillId.get(row.id) ?? []) : [];
                    return (
                      <div key={`culture-type-rank-${def.id}-${index}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
                        <div style={{ color: 'var(--muted)' }}>
                          {categoryNameById.get(def.id) ?? def.id}: select one skill to gain {def.value} rank{def.value === 1 ? '' : 's'}.
                        </div>
                        <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'minmax(260px, 1fr) minmax(220px, 1fr)' }}>
                          <RichSelect
                            label="Skill"
                            value={row.id}
                            onChange={(value) => updateFlatSkillChoiceRow(setCultureTypeCategorySkillRankRows, index, {
                              id: value,
                              subcategory: '',
                            })}
                            options={optionList}
                            placeholderOption="— Select skill —"
                          />
                          {row.id ? (
                            <LabeledSelect
                              label="Weapon Type"
                              value={row.subcategory}
                              onChange={(value) => updateFlatSkillChoiceRow(setCultureTypeCategorySkillRankRows, index, {
                                subcategory: value,
                              })}
                              options={weaponTypeOptions}
                              disabled={weaponTypeOptions.length === 0}
                              helperText={weaponTypeOptions.length === 0 ? 'No weapon types available for selected skill.' : undefined}
                              placeholderOption="— Select weapon type —"
                              error={errors.initial && weaponTypeOptions.length > 0 && !row.subcategory.trim() ? 'Required' : undefined}
                            />
                          ) : (
                            <div />
                          )}
                        </div>
                        {row.id && row.subcategory && weaponTypeOptions.length > 0 && (
                          <div style={{ color: 'var(--muted)' }}>
                            Selected weapon type: {weaponTypeNameById.get(row.subcategory) ?? row.subcategory}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {professionSkillDevelopmentChoiceDefinitions.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <h4 style={{ margin: 0 }}>Profession Skill Development Types</h4>
                  {professionSkillDevelopmentChoiceDefinitions.map((choice, choiceIndex) => {
                    const rows = professionSkillDevelopmentChoiceRows[choiceIndex] ?? [];
                    const optionList = professionSkillDevelopmentOptions[choiceIndex] ?? [];
                    return (
                      <div key={`prof-skill-dev-${choiceIndex}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
                        <div style={{ color: 'var(--muted)' }}>
                          Choice #{choiceIndex + 1}: select exactly {choice.numChoices} skill{choice.numChoices === 1 ? '' : 's'} for {choice.type}.
                        </div>
                        {rows.map((row, rowIndex) => (
                          <div key={`prof-skill-dev-${choiceIndex}-${rowIndex}`} style={{ display: 'grid', gap: 6, gridTemplateColumns: 'minmax(260px, 1fr) minmax(220px, 1fr)' }}>
                            {(() => {
                              const selectedByOtherRows = new Map<string, { hasEmptySubcategory: boolean }>();
                              for (let i = 0; i < rows.length; i++) {
                                if (i === rowIndex) continue;
                                const other = rows[i];
                                if (!other?.id) continue;
                                const current = selectedByOtherRows.get(other.id) ?? { hasEmptySubcategory: false };
                                current.hasEmptySubcategory = current.hasEmptySubcategory || !other.subcategory.trim();
                                selectedByOtherRows.set(other.id, current);
                              }
                              const availableOptions = optionList.filter((opt) => {
                                if (opt.value === row.id) return true;
                                const state = selectedByOtherRows.get(opt.value);
                                if (!state) return true;
                                return row.subcategory.trim().length > 0 && !state.hasEmptySubcategory;
                              });
                              return (
                                <RichSelect
                                  label={`Skill ${rowIndex + 1}`}
                                  value={row.id}
                                  onChange={(value) => updateGroupedSkillChoiceRow(setProfessionSkillDevelopmentChoiceRows, choiceIndex, rowIndex, {
                                    id: value,
                                    subcategory: '',
                                  })}
                                  options={availableOptions}
                                  placeholderOption="— Select skill —"
                                />
                              );
                            })()}
                            {row.id && (mandatorySubcategorySkillIds.has(row.id) || languageSkillIds.has(row.id)) ? (
                              languageSkillIds.has(row.id) ? (
                                <LabeledSelect
                                  label="Language"
                                  value={row.subcategory}
                                  onChange={(value) => updateGroupedSkillChoiceRow(setProfessionSkillDevelopmentChoiceRows, choiceIndex, rowIndex, {
                                    subcategory: value,
                                  })}
                                  options={languageOptions}
                                  placeholderOption="— Select language —"
                                  error={errors.initial && !row.subcategory.trim() ? 'Required' : undefined}
                                />
                              ) : (
                                <LabeledInput
                                  label="Subcategory"
                                  value={row.subcategory}
                                  onChange={(value) => updateGroupedSkillChoiceRow(setProfessionSkillDevelopmentChoiceRows, choiceIndex, rowIndex, {
                                    subcategory: value,
                                  })}
                                  placeholder="Enter subcategory"
                                  error={errors.initial && !row.subcategory.trim() ? 'Required' : undefined}
                                />
                              )
                            ) : (
                              <div />
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {professionCategoryDevelopmentChoiceDefinitions.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <h4 style={{ margin: 0 }}>Profession Category Skill Development Types</h4>
                  {professionCategoryDevelopmentChoiceDefinitions.map((choice, choiceIndex) => {
                    const rows = professionCategoryDevelopmentChoiceRows[choiceIndex] ?? [];
                    const optionList = professionCategoryDevelopmentOptions[choiceIndex] ?? [];
                    return (
                      <div key={`prof-category-dev-${choiceIndex}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
                        <div style={{ color: 'var(--muted)' }}>
                          Choice #{choiceIndex + 1}: select exactly {choice.numChoices} skill{choice.numChoices === 1 ? '' : 's'} for {choice.type}.
                        </div>
                        {rows.map((row, rowIndex) => (
                          <div key={`prof-category-dev-${choiceIndex}-${rowIndex}`} style={{ display: 'grid', gap: 6, gridTemplateColumns: 'minmax(260px, 1fr) minmax(220px, 1fr)' }}>
                            {(() => {
                              const selectedByOtherRows = new Map<string, { hasEmptySubcategory: boolean }>();
                              for (let i = 0; i < rows.length; i++) {
                                if (i === rowIndex) continue;
                                const other = rows[i];
                                if (!other?.id) continue;
                                const current = selectedByOtherRows.get(other.id) ?? { hasEmptySubcategory: false };
                                current.hasEmptySubcategory = current.hasEmptySubcategory || !other.subcategory.trim();
                                selectedByOtherRows.set(other.id, current);
                              }
                              const availableOptions = optionList.filter((opt) => {
                                if (opt.value === row.id) return true;
                                const state = selectedByOtherRows.get(opt.value);
                                if (!state) return true;
                                return row.subcategory.trim().length > 0 && !state.hasEmptySubcategory;
                              });
                              return (
                                <RichSelect
                                  label={`Skill ${rowIndex + 1}`}
                                  value={row.id}
                                  onChange={(value) => updateGroupedSkillChoiceRow(setProfessionCategoryDevelopmentChoiceRows, choiceIndex, rowIndex, {
                                    id: value,
                                    subcategory: '',
                                  })}
                                  options={availableOptions}
                                  placeholderOption="— Select skill —"
                                />
                              );
                            })()}
                            {row.id && (mandatorySubcategorySkillIds.has(row.id) || languageSkillIds.has(row.id)) ? (
                              languageSkillIds.has(row.id) ? (
                                <LabeledSelect
                                  label="Language"
                                  value={row.subcategory}
                                  onChange={(value) => updateGroupedSkillChoiceRow(setProfessionCategoryDevelopmentChoiceRows, choiceIndex, rowIndex, {
                                    subcategory: value,
                                  })}
                                  options={languageOptions}
                                  placeholderOption="— Select language —"
                                  error={errors.initial && !row.subcategory.trim() ? 'Required' : undefined}
                                />
                              ) : (
                                <LabeledInput
                                  label="Subcategory"
                                  value={row.subcategory}
                                  onChange={(value) => updateGroupedSkillChoiceRow(setProfessionCategoryDevelopmentChoiceRows, choiceIndex, rowIndex, {
                                    subcategory: value,
                                  })}
                                  placeholder="Enter subcategory"
                                  error={errors.initial && !row.subcategory.trim() ? 'Required' : undefined}
                                />
                              )
                            ) : (
                              <div />
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {professionGroupDevelopmentChoiceDefinitions.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <h4 style={{ margin: 0 }}>Profession Group Skill Development Types</h4>
                  {professionGroupDevelopmentChoiceDefinitions.map((choice, choiceIndex) => {
                    const rows = professionGroupDevelopmentChoiceRows[choiceIndex] ?? [];
                    const optionList = professionGroupDevelopmentOptions[choiceIndex] ?? [];
                    return (
                      <div key={`prof-group-dev-${choiceIndex}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
                        <div style={{ color: 'var(--muted)' }}>
                          Choice #{choiceIndex + 1}: select exactly {choice.numChoices} skill{choice.numChoices === 1 ? '' : 's'} for {choice.type}.
                        </div>
                        {rows.map((row, rowIndex) => (
                          <div key={`prof-group-dev-${choiceIndex}-${rowIndex}`} style={{ display: 'grid', gap: 6, gridTemplateColumns: 'minmax(260px, 1fr) minmax(220px, 1fr)' }}>
                            {(() => {
                              const selectedByOtherRows = new Map<string, { hasEmptySubcategory: boolean }>();
                              for (let i = 0; i < rows.length; i++) {
                                if (i === rowIndex) continue;
                                const other = rows[i];
                                if (!other?.id) continue;
                                const current = selectedByOtherRows.get(other.id) ?? { hasEmptySubcategory: false };
                                current.hasEmptySubcategory = current.hasEmptySubcategory || !other.subcategory.trim();
                                selectedByOtherRows.set(other.id, current);
                              }
                              const availableOptions = optionList.filter((opt) => {
                                if (opt.value === row.id) return true;
                                const state = selectedByOtherRows.get(opt.value);
                                if (!state) return true;
                                return row.subcategory.trim().length > 0 && !state.hasEmptySubcategory;
                              });
                              return (
                                <RichSelect
                                  label={`Skill ${rowIndex + 1}`}
                                  value={row.id}
                                  onChange={(value) => updateGroupedSkillChoiceRow(setProfessionGroupDevelopmentChoiceRows, choiceIndex, rowIndex, {
                                    id: value,
                                    subcategory: '',
                                  })}
                                  options={availableOptions}
                                  placeholderOption="— Select skill —"
                                />
                              );
                            })()}
                            {row.id && (mandatorySubcategorySkillIds.has(row.id) || languageSkillIds.has(row.id)) ? (
                              languageSkillIds.has(row.id) ? (
                                <LabeledSelect
                                  label="Language"
                                  value={row.subcategory}
                                  onChange={(value) => updateGroupedSkillChoiceRow(setProfessionGroupDevelopmentChoiceRows, choiceIndex, rowIndex, {
                                    subcategory: value,
                                  })}
                                  options={languageOptions}
                                  placeholderOption="— Select language —"
                                  error={errors.initial && !row.subcategory.trim() ? 'Required' : undefined}
                                />
                              ) : (
                                <LabeledInput
                                  label="Subcategory"
                                  value={row.subcategory}
                                  onChange={(value) => updateGroupedSkillChoiceRow(setProfessionGroupDevelopmentChoiceRows, choiceIndex, rowIndex, {
                                    subcategory: value,
                                  })}
                                  placeholder="Enter subcategory"
                                  error={errors.initial && !row.subcategory.trim() ? 'Required' : undefined}
                                />
                              )
                            ) : (
                              <div />
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {professionBaseSpellListChoiceDefinitions.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <h4 style={{ margin: 0 }}>Profession Base Spell Lists</h4>
                  {professionBaseSpellListChoiceDefinitions.map((choice, choiceIndex) => {
                    const rows = professionBaseSpellListChoiceRows[choiceIndex] ?? [];
                    const options = choice.options
                      .map(toSpellListRichOption)
                      .sort((a, b) => a.searchText!.localeCompare(b.searchText!));
                    return (
                      <div key={`prof-base-spell-${choiceIndex}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
                        <div style={{ color: 'var(--muted)' }}>
                          Choice #{choiceIndex + 1}: select exactly {choice.numChoices} spell list{choice.numChoices === 1 ? '' : 's'}.
                        </div>
                        {rows.map((spellListId, rowIndex) => (
                          (() => {
                            const selectedOtherIds = new Set(
                              professionBaseSpellListChoiceRows
                                .flatMap((group, groupIndex) => group
                                  .map((value, index) => ({ value, groupIndex, index })),
                                )
                                .filter((entry) => !(entry.groupIndex === choiceIndex && entry.index === rowIndex))
                                .map((entry) => entry.value)
                                .filter(Boolean),
                            );
                            const availableOptions = options.filter((opt) => !selectedOtherIds.has(opt.value) || opt.value === spellListId);
                            return (
                              <RichSelect
                                key={`prof-base-spell-${choiceIndex}-${rowIndex}`}
                                label={`Spell List ${rowIndex + 1}`}
                                value={spellListId}
                                onChange={(value) => updateBaseSpellListChoiceRow(choiceIndex, rowIndex, value)}
                                options={availableOptions}
                                placeholderOption="— Select spell list —"
                              />
                            );
                          })()
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {profession?.spellUserType === 'Pure' && (() => {
                const pureGroupIndex = professionBaseSpellListChoiceDefinitions.length;
                const pureRows = professionBaseSpellListChoiceRows[pureGroupIndex] ?? [];
                return (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <h4 style={{ margin: 0 }}>Pure Spell User Extra Lists</h4>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
                      <div style={{ color: 'var(--muted)' }}>
                        Select {PURE_EXTRA_SPELL_LIST_COUNT} additional spell lists from Open and Closed lists.
                      </div>
                      {pureRows.map((spellListId, rowIndex) => {
                        const selectedOtherIds = new Set(
                          professionBaseSpellListChoiceRows
                            .flatMap((group, groupIndex) => group
                              .map((value, index) => ({ value, groupIndex, index })),
                            )
                            .filter((entry) => !(entry.groupIndex === pureGroupIndex && entry.index === rowIndex))
                            .map((entry) => entry.value)
                            .filter(Boolean),
                        );
                        const availableOptions = pureExtraSpellListOptions.filter(
                          (opt) => !selectedOtherIds.has(opt.value) || opt.value === spellListId,
                        );
                        return (
                          <RichSelect
                            key={`pure-extra-spell-${rowIndex}`}
                            label={`Spell List ${rowIndex + 1}`}
                            value={spellListId}
                            onChange={(value) => updateBaseSpellListChoiceRow(pureGroupIndex, rowIndex, value)}
                            options={availableOptions}
                            placeholderOption="— Select spell list —"
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {professionWeaponCategoryCostDefinitions.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <h4 style={{ margin: 0 }}>Allocate Weapon Costs</h4>
                  {professionWeaponCategoryCostDefinitions.map((def, index) => {
                    const selectedCategory = professionWeaponCategoryCostSelections[index] ?? '';

                    return (
                      <div key={`weapon-cost-${index}-${def.cost}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
                        <div style={{ display: 'grid', gap: 6, gridTemplateColumns: '200px minmax(280px, 1fr)' }}>
                          <LabeledInput
                            label="Cost"
                            value={def.cost}
                            onChange={() => { }}
                            inputProps={{ readOnly: true }}
                            disabled
                          />
                          <LabeledSelect
                            label="Skill Category"
                            value={selectedCategory}
                            onChange={(value) => setProfessionWeaponCategoryCostSelections((prev) => {
                              const next = prev.slice();
                              const currentValue = next[index] ?? '';
                              const otherIndex = next.findIndex((entry, i) => i !== index && entry === value);

                              if (otherIndex >= 0) {
                                next[otherIndex] = currentValue;
                              }

                              next[index] = value;
                              return next;
                            })}
                            options={weaponSkillCategoryOptions}
                            placeholderOption="— Select weapon category —"
                            error={errors.initial && !selectedCategory ? 'Required' : undefined}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {errors.initial && <div style={{ color: '#b00020' }}>{errors.initial}</div>}
            </section>
          )}

          {step === 'stats' && (
            <section style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={generateAllTemporary}
                  disabled={statRollsLocked}
                  title={statRollsLocked ? 'Stat rolls are locked. Reset to generate new rolls.' : undefined}
                >Generate 10 Temporary Rolls (d100)</button>
                <button
                  type="button"
                  onClick={getPotentials}
                  disabled={statRollsLocked || generatingStats || !raceId || !cultureId || !professionId || selectedRealms.length === 0}
                  title={
                    statRollsLocked ? 'Stat rolls are already locked.' :
                      generatingStats ? 'Generating potentials…' :
                        (!raceId || !cultureId || !professionId || selectedRealms.length === 0) ? 'Race, culture, profession, and realm must be selected before generating potentials.' :
                          undefined
                  }
                >Get potentials</button>
              </div>

              <div style={{ color: 'var(--muted)' }}>
                Generate the roll pool first, then assign each generated result to a stat. Prime stats from profession: {primeStats.length ? primeStats.join(', ') : 'None defined'}
              </div>

              {/* Stat rolls grid. Each roll has temporary value input, potential display, and stat assignment select. Assigned prime stats are highlighted. */}
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(560px, 1fr))' }}>
                {statRolls.map((roll) => {
                  const isPrime = roll.assignedStat ? primeStats.includes(roll.assignedStat) : false;
                  const assignedStats = new Set(
                    statRolls
                      .filter((entry) => entry.assignedStat && entry.slot !== roll.slot)
                      .map((entry) => entry.assignedStat)
                  );
                  return (
                    <div key={roll.slot} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: isPrime ? 'var(--primary-weak)' : 'transparent' }}>
                      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'end' }}>
                        <LabeledInput
                          label={`Roll ${roll.slot} Temporary`}
                          value={roll.temporary}
                          onChange={(v) => onChangeTemporaryRoll(roll.slot, v)}
                          helperText="25-100"
                          disabled={statRollsLocked}
                        />

                        <LabeledInput
                          label="Potential"
                          value={roll.potential == null ? '' : String(roll.potential)}
                          onChange={() => { }}
                          disabled
                          helperText="REST result"
                        />

                        <LabeledSelect
                          label="Assign To Stat"
                          value={roll.assignedStat}
                          onChange={(value) => setStatRolls((prev) => prev.map((entry) =>
                            entry.slot === roll.slot ? { ...entry, assignedStat: value as Stat | '' } : entry
                          ))}
                          options={STATS.map((stat) => ({
                            value: stat,
                            label: `${stat}${developmentStats.has(stat) ? ' *' : ''}${primeStats.includes(stat) ? ' (Prime)' : ''}`,
                            disabled: assignedStats.has(stat),
                          }))}
                          placeholderOption="— Assign stat —"
                          disabled={!statRollsLocked}
                          helperText={roll.assignedStat && primeStats.includes(roll.assignedStat) ? 'Prime stat assignment' : undefined}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {errors.stats && <div style={{ color: '#b00020' }}>{errors.stats}</div>}
            </section>
          )}

          {step === 'physique' && (
            <section style={{ display: 'grid', gap: 14 }}>
              <div>
                <h4 style={{ margin: '0 0 4px' }}>Height</h4>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'grid', gap: 10 }}>
                  <CheckboxInput
                    label="Auto-generate height"
                    checked={physiqueAutoHeight}
                    onChange={(checked) => {
                      setPhysiqueAutoHeight(checked);
                      if (checked) setPhysiqueEnteredHeightStr('');
                    }}
                  />
                  {!physiqueAutoHeight && (
                    <LabeledInput
                      label="Height (inches)"
                      value={physiqueEnteredHeightStr}
                      onChange={(v) => setPhysiqueEnteredHeightStr(sanitizeUnsignedInt(v))}
                      placeholder="e.g. 70"
                      helperText="Positive integer (inches)"
                      error={errors.physique && !physiqueAutoHeight && (!physiqueEnteredHeightStr.trim() || !isValidUnsignedInt(physiqueEnteredHeightStr) || Number(physiqueEnteredHeightStr) <= 0) ? 'Enter a valid positive integer' : undefined}
                    />
                  )}
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 4px' }}>Build Modifier</h4>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'grid', gap: 10 }}>
                  <CheckboxInput
                    label="Auto-generate build modifier"
                    checked={physiqueAutoBuildMod}
                    onChange={(checked) => {
                      setPhysiqueAutoBuildMod(checked);
                      if (checked) setPhysiqueEnteredBuildMod(0);
                    }}
                  />
                  {!physiqueAutoBuildMod && (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                        A value of 0 indicates average build for the selected race. Negative values indicate a more slender character; positive values indicate a larger frame.
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setPhysiqueEnteredBuildMod((v) => Math.max(-10, v - 1))}
                          disabled={physiqueEnteredBuildMod <= -10}
                        >
                          -
                        </button>
                        <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 600 }}>{physiqueEnteredBuildMod}</span>
                        <button
                          type="button"
                          onClick={() => setPhysiqueEnteredBuildMod((v) => Math.min(10, v + 1))}
                          disabled={physiqueEnteredBuildMod >= 10}
                        >
                          +
                        </button>
                        <span style={{ color: 'var(--muted)', marginLeft: 8 }}>
                          Build: <strong>{getBuildLabel(physiqueEnteredBuildMod)}</strong>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {errors.physique && <div style={{ color: '#b00020' }}>{errors.physique}</div>}
            </section>
          )}

          {step === 'hobby' && (
            <section style={{ display: 'grid', gap: 14 }}>
              <div>
                <h4 style={{ margin: '0 0 8px' }}>Hobby Skill/Category Ranks</h4>
                <div style={{ color: hobbyRankRemaining < 0 ? '#b00020' : 'var(--muted)' }}>
                  Remaining hobby ranks: {hobbyRankRemaining} / {hobbyRanksBudget}
                </div>
              </div>

              <div>
                {sortedHobbySkillRows.length === 0 && sortedHobbyCategoryRows.length === 0 ? (
                  <div style={{ color: 'var(--muted)' }}>No hobby skill/category rows available.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {sortedHobbySkillRows.length > 0 && (
                      <>
                        <h4 style={{ margin: '0 0 4px' }}>Hobby Skills</h4>
                        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
                          {sortedHobbySkillRows.map(({ row, index, label }) => (
                            <div key={`hskill-${row.id}-${index}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
                              <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={label}>{label}</strong>
                              {mandatorySubcategorySkillIds.has(row.id) && (
                                <LabeledInput
                                  label="Subcategory"
                                  hideLabel={true}
                                  value={row.subcategory ?? ''}
                                  onChange={(v) => setHobbySkillRows((prev) => prev.map((entry, idx) => (
                                    idx === index ? { ...entry, subcategory: v } : entry
                                  )))}
                                  placeholder="Enter subcategory"
                                  disabled={row.subcategoryLocked}
                                  error={errors.hobby && row.value > row.base && !(row.subcategory?.trim()) ? 'Required' : undefined}
                                />
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                                <small style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>Base: {row.base}, Max: {row.max}</small>
                                <button
                                  type="button"
                                  onClick={() => setHobbySkillRows((prev) => prev.map((entry, idx) => (
                                    idx === index ? { ...entry, value: Math.max(entry.base, entry.value - 1) } : entry
                                  )))}
                                  disabled={row.value <= row.base}
                                >
                                  -
                                </button>
                                <span style={{ minWidth: 20, textAlign: 'center', whiteSpace: 'nowrap' }}>{row.value}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (hobbyRankRemaining <= 0 || row.value >= row.max) return;
                                    setHobbySkillRows((prev) => prev.map((entry, idx) => (
                                      idx === index ? { ...entry, value: entry.value + 1 } : entry
                                    )));
                                  }}
                                  disabled={hobbyRankRemaining <= 0 || row.value >= row.max}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {sortedHobbyCategoryRows.length > 0 && (
                      <>
                        <h4 style={{ margin: '8px 0 4px' }}>Hobby Categories</h4>
                        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
                          {sortedHobbyCategoryRows.map(({ row, index, label }) => (
                            <div key={`hcat-${row.id}-${index}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
                              <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={label}>{label}</strong>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                                <small style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>Base: {row.base}, Max: {row.max}</small>
                                <button
                                  type="button"
                                  onClick={() => setHobbyCategoryRows((prev) => prev.map((entry, idx) => (
                                    idx === index ? { ...entry, value: Math.max(entry.base, entry.value - 1) } : entry
                                  )))}
                                  disabled={row.value <= row.base}
                                >
                                  -
                                </button>
                                <span style={{ minWidth: 20, textAlign: 'center', whiteSpace: 'nowrap' }}>{row.value}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (hobbyRankRemaining <= 0 || row.value >= row.max) return;
                                    setHobbyCategoryRows((prev) => prev.map((entry, idx) => (
                                      idx === index ? { ...entry, value: entry.value + 1 } : entry
                                    )));
                                  }}
                                  disabled={hobbyRankRemaining <= 0 || row.value >= row.max}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px' }}>Hobby Language Ranks</h4>
                <div style={{ color: languageRankRemaining < 0 ? '#b00020' : 'var(--muted)', marginBottom: 6 }}>
                  Remaining language ranks: {languageRankRemaining} / {languageRanksBudget}
                </div>
                {hobbyLanguageRows.length === 0 ? (
                  <div style={{ color: 'var(--muted)' }}>No hobby language rows available.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))' }}>
                    {hobbyLanguageRows.map((row, i) => {
                      const controls: Array<{ key: 'spoken' | 'written' | 'somatic'; label: string; base: number; value: number; max: number }> = [
                        { key: 'spoken', label: 'Spoken', base: row.baseSpoken, value: row.spoken, max: row.maxSpoken },
                        { key: 'written', label: 'Written', base: row.baseWritten, value: row.written, max: row.maxWritten },
                        { key: 'somatic', label: 'Somatic', base: row.baseSomatic, value: row.somatic, max: row.maxSomatic },
                      ];

                      return (
                        <div key={`hlang-${row.language}-${i}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
                          <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={languageNameById.get(row.language) ?? row.language}>
                            {languageNameById.get(row.language) ?? row.language}
                          </strong>
                          {controls.map((control) => (
                            <div key={`${row.language}-${control.key}`} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                              <span style={{ minWidth: 74, whiteSpace: 'nowrap' }}>{control.label}</span>
                              <small style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>Base: {control.base}, Max: {control.max}</small>
                              <button
                                type="button"
                                onClick={() => setHobbyLanguageRows((prev) => prev.map((entry, idx) => {
                                  if (idx !== i) return entry;
                                  const nextVal = Math.max(control.base, control.value - 1);
                                  return { ...entry, [control.key]: nextVal };
                                }))}
                                disabled={control.value <= control.base}
                              >
                                -
                              </button>
                              <span style={{ minWidth: 20, textAlign: 'center', whiteSpace: 'nowrap' }}>{control.value}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (languageRankRemaining <= 0 || control.value >= control.max) return;
                                  setHobbyLanguageRows((prev) => prev.map((entry, idx) => {
                                    if (idx !== i) return entry;
                                    return { ...entry, [control.key]: control.value + 1 };
                                  }));
                                }}
                                disabled={languageRankRemaining <= 0 || control.value >= control.max}
                              >
                                +
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {spellListRanksBudget > 0 && (
                <RichSelect
                  label={`Hobby Spell List (${spellListRanksBudget} ranks)`}
                  value={hobbySpellListId}
                  onChange={(v) => setHobbySpellListId(v)}
                  options={hobbySpellListOptions.map(toSpellListRichOption)}
                  error={errors.hobby && !hobbySpellListId ? 'Required' : undefined}
                />
              )}

              {errors.hobby && <div style={{ color: '#b00020' }}>{errors.hobby}</div>}
            </section>
          )}

          {step === 'background' && (
            <section style={{ display: 'grid', gap: 10 }}>
              <div>
                Budget: <strong>{backgroundBudget}</strong> | Selected: <strong>{selectedBackgroundPoints}</strong>
              </div>
              <div style={{ color: 'var(--muted)' }}>
                Spend background option points across the options below.
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <div style={backgroundOptionCardShellStyle}>
                  <CheckboxInput
                    label="Extra Stat Gain Rolls"
                    checked={backgroundExtraStatGainRolls}
                    onChange={backgroundActions.toggleExtraStatGainRolls}
                    disabled={!backgroundExtraStatGainRolls && !canSpendBackgroundPoints(1)}
                  />
                </div>

                <div style={{ ...backgroundOptionCardShellStyle, display: 'grid', gap: 8 }}>
                  <strong>Extra Money</strong>
                  <div style={{ color: 'var(--muted)' }}>Spend 1 or 2 points.</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={backgroundActions.decrementExtraMoneyPoints}
                      disabled={backgroundExtraMoneyPoints <= 0}
                    >
                      -
                    </button>
                    <span style={{ minWidth: 20, textAlign: 'center' }}>{backgroundExtraMoneyPoints}</span>
                    <button
                      type="button"
                      onClick={backgroundActions.incrementExtraMoneyPoints}
                      disabled={backgroundExtraMoneyPoints >= 2 || !canSpendBackgroundPoints(1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div style={{ ...backgroundOptionCardShellStyle, display: 'grid', gap: 10 }}>
                  <CheckboxInput
                    label="Extra Languages"
                    checked={backgroundExtraLanguages}
                    onChange={backgroundActions.toggleExtraLanguages}
                    disabled={!backgroundExtraLanguages && !canSpendBackgroundPoints(1)}
                  />

                  {backgroundExtraLanguages && (
                    <>
                      <div style={{ color: backgroundLanguageRankRemaining < 0 ? '#b00020' : 'var(--muted)' }}>
                        Remaining language ranks: {backgroundLanguageRankRemaining} / {backgroundLanguageRanksBudget}
                      </div>

                      {backgroundLanguageRows.length === 0 ? (
                        <div style={{ color: 'var(--muted)' }}>No culture background languages are available.</div>
                      ) : (
                        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))' }}>
                          {backgroundLanguageRows.map((row, rowIndex) => {
                            const controls: Array<{ key: 'spoken' | 'written' | 'somatic'; label: string; value: number; max: number }> = [
                              { key: 'spoken', label: 'Spoken', value: row.spoken, max: row.maxSpoken },
                              { key: 'written', label: 'Written', value: row.written, max: row.maxWritten },
                              { key: 'somatic', label: 'Somatic', value: row.somatic, max: row.maxSomatic },
                            ];

                            return (
                              <div key={`bg-lang-${row.language}-${rowIndex}`} style={{ ...backgroundOptionCardShellStyle, display: 'grid', gap: 8 }}>
                                <strong>{languageNameById.get(row.language) ?? row.language}</strong>
                                {controls.map((control) => (
                                  <div key={`${row.language}-${control.key}`} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                                    <span style={{ minWidth: 74, whiteSpace: 'nowrap' }}>{control.label}</span>
                                    <small style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                      Base: {control.key === 'spoken' ? row.baseSpoken : control.key === 'written' ? row.baseWritten : row.baseSomatic}, Max: {control.max}
                                    </small>
                                    <button
                                      type="button"
                                      onClick={() => updateBackgroundLanguageRank(rowIndex, control.key, -1)}
                                      disabled={
                                        control.value
                                        <= (control.key === 'spoken' ? row.baseSpoken : control.key === 'written' ? row.baseWritten : row.baseSomatic)
                                      }
                                    >
                                      -
                                    </button>
                                    <span style={{ minWidth: 20, textAlign: 'center', whiteSpace: 'nowrap' }}>{control.value}</span>
                                    <button
                                      type="button"
                                      onClick={() => updateBackgroundLanguageRank(rowIndex, control.key, 1)}
                                      disabled={backgroundLanguageRankRemaining <= 0 || control.value >= control.max}
                                    >
                                      +
                                    </button>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div style={{ ...backgroundOptionCardShellStyle, display: 'grid', gap: 8 }}>
                  <strong>Skill Bonus</strong>
                  <div style={{ color: 'var(--muted)' }}>Each selected skill grants +10 and costs 1 point.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <RichSelect
                        label="Skill Category"
                        hideLabel={true}
                        value={backgroundSkillCategoryFilter}
                        onChange={(v) => {
                          setBackgroundSkillCategoryFilter(v);
                          setBackgroundSkillPendingId('');
                          setBackgroundSkillPendingSubcategory('');
                        }}
                        options={backgroundSkillCategoryOptions}
                        placeholderOption="— Filter by category —"
                      />
                      <RichSelect
                        label="Add Skill Bonus"
                        hideLabel={true}
                        value=""
                        onChange={backgroundActions.addSkillBonus}
                        options={availableBackgroundSkillBonusOptions}
                        placeholderOption={backgroundSkillCategoryFilter ? '— Select skill —' : '— Select a category first —'}
                        disabled={!backgroundSkillCategoryFilter || !canSpendBackgroundPoints(1)}
                      />
                    </div>
                    {backgroundSkillPendingId && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500 }}>{skillNameById.get(backgroundSkillPendingId) ?? backgroundSkillPendingId}:</span>
                        {weaponGroupSkillIds.has(backgroundSkillPendingId) ? (
                          <LabeledSelect
                            label="Weapon type"
                            hideLabel={true}
                            value={backgroundSkillPendingSubcategory}
                            onChange={(v) => setBackgroundSkillPendingSubcategory(v)}
                            options={weaponTypeOptionsBySkillId.get(backgroundSkillPendingId) ?? []}
                            placeholderOption="— Select weapon type —"
                          />
                        ) : (
                          <LabeledInput
                            label="Subcategory"
                            hideLabel={true}
                            value={backgroundSkillPendingSubcategory}
                            onChange={(v) => setBackgroundSkillPendingSubcategory(v)}
                            placeholder="Subcategory"
                          />
                        )}
                        <button
                          type="button"
                          disabled={!backgroundSkillPendingSubcategory.trim()}
                          onClick={backgroundActions.confirmSkillBonusPending}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={backgroundActions.cancelSkillBonusPending}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  {backgroundSkillBonusRows.length > 0 && (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {backgroundSkillBonusRows.map((row, rowIndex) => {
                        const isWeaponGroupSkill = weaponGroupSkillIds.has(row.id);
                        const weaponTypeOptions = weaponTypeOptionsBySkillId.get(row.id) ?? [];
                        const requiresFreeTextSubcategory = mandatorySubcategorySkillIds.has(row.id) && !isWeaponGroupSkill;

                        return (
                          <div
                            key={`bg-skill-${rowIndex}`}
                            style={{
                              display: 'grid',
                              gap: 8,
                              gridTemplateColumns: 'minmax(220px, 1fr) minmax(260px, 1fr) auto',
                              alignItems: 'end',
                            }}
                          >
                            <span>{skillNameById.get(row.id) ?? row.id} (+10)</span>
                            {isWeaponGroupSkill ? (
                              <LabeledSelect
                                label={`Weapon type for ${skillNameById.get(row.id) ?? row.id}`}
                                hideLabel={true}
                                value={row.subcategory}
                                onChange={(value) => backgroundActions.updateSkillBonusSubcategory(rowIndex, value)}
                                options={weaponTypeOptions}
                                disabled={weaponTypeOptions.length === 0}
                                helperText={weaponTypeOptions.length === 0 ? 'No weapon types available for selected skill.' : undefined}
                                placeholderOption="— Select weapon type —"
                                error={errors.background && weaponTypeOptions.length > 0 && !row.subcategory.trim() ? 'Required' : undefined}
                              />
                            ) : requiresFreeTextSubcategory ? (
                              <LabeledInput
                                label={`Subcategory for ${skillNameById.get(row.id) ?? row.id}`}
                                hideLabel={true}
                                value={row.subcategory}
                                onChange={(value) => backgroundActions.updateSkillBonusSubcategory(rowIndex, value)}
                                placeholder="Enter subcategory"
                                error={errors.background && !row.subcategory.trim() ? 'Required' : undefined}
                              />
                            ) : (
                              <div />
                            )}
                            <button
                              type="button"
                              onClick={() => backgroundActions.removeSkillBonus(rowIndex)}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ ...backgroundOptionCardShellStyle, display: 'grid', gap: 8 }}>
                  <strong>Skill Category Bonus</strong>
                  <div style={{ color: 'var(--muted)' }}>Each selected category grants +5 and costs 1 point.</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
                    <LabeledSelect
                      label="Add Skill Category Bonus"
                      hideLabel={true}
                      value=""
                      onChange={backgroundActions.addCategoryBonus}
                      options={availableBackgroundCategoryBonusOptions}
                      placeholderOption="— Select category —"
                      disabled={availableBackgroundCategoryBonusOptions.length === 0 || !canSpendBackgroundPoints(1)}
                    />
                  </div>
                  {backgroundCategoryBonusIds.length > 0 && (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {backgroundCategoryBonusIds.map((id) => (
                        <div key={`bg-category-${id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span>{categoryNameById.get(id) ?? id} (+5)</span>
                          <button
                            type="button"
                            onClick={() => backgroundActions.removeCategoryBonus(id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ ...backgroundOptionCardShellStyle, display: 'grid', gap: 8 }}>
                  <strong>Special Items</strong>
                  <div style={{ color: 'var(--muted)' }}>Spend 1 or 2 points.</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={backgroundActions.decrementSpecialItemsPoints}
                      disabled={backgroundSpecialItemsPoints <= 0}
                    >
                      -
                    </button>
                    <span style={{ minWidth: 20, textAlign: 'center' }}>{backgroundSpecialItemsPoints}</span>
                    <button
                      type="button"
                      onClick={backgroundActions.incrementSpecialItemsPoints}
                      disabled={backgroundSpecialItemsPoints >= 2 || !canSpendBackgroundPoints(1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {errors.background && <div style={{ color: '#b00020' }}>{errors.background}</div>}
            </section>
          )}

          {step === 'apprenticeship' && (
            <section style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: 'var(--muted)' }}>
                  {apprenticeSubstep === 'selecting' && 'Select training packages. TPs with required choices must be resolved before spending extra development points.'}
                  {apprenticeSubstep === 'resolving' && `Resolve training package choices (${apprenticeResolvingTpIndex + 1} of ${tpsRequiringResolution.length}).`}
                  {apprenticeSubstep === 'purchasing' && 'Spend remaining development points on stat gains, skill ranks, category ranks, and spell list ranks. Unspent points carry to the next level.'}
                </div>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 16 }}>
                  DP: {apprenticeDpRemaining} / {characterBuilder.developmentPoints}
                </div>
              </div>

              {/* SELECTING sub-step */}
              {apprenticeSubstep === 'selecting' && (
                <>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <h4 style={{ margin: '0 0 8px' }}>Training Packages</h4>
                    {selectedApprenticeTrainingPackages.length > 0 && (
                      <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                        {selectedApprenticeTrainingPackages.map((tp) => {
                          const cost = tpCostMap.get(tp.id) ?? 0;
                          return (
                            <div key={tp.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ flex: 1 }}>
                                {tp.name}{tp.lifestyle ? ' (Lifestyle)' : ''} — {cost} DP
                                {tpHasChoices(tp) && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>(choices required)</span>}
                              </span>
                              <button
                                type="button"
                                onClick={() => setApprenticeTrainingPackageIds((prev) => prev.filter((id) => id !== tp.id))}
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <RichSelect
                      label="Add Training Package"
                      hideLabel={true}
                      value=""
                      onChange={(v) => {
                        if (v) setApprenticeTrainingPackageIds((prev) => [...prev, v]);
                      }}
                      options={apprenticeTrainingPackageOptions}
                      placeholderOption="— Add training package —"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        if (tpsRequiringResolution.length === 0) {
                          setApprenticeSubstep('purchasing');
                        } else {
                          setApprenticeResolvingTpIndex(0);
                          setApprenticeSubstep('resolving');
                        }
                      }}
                    >
                      {tpsRequiringResolution.length === 0 ? 'Proceed to Extra Purchases ?' : 'Proceed to Resolve TP Choices ?'}
                    </button>
                  </div>
                </>
              )}

              {/* RESOLVING sub-step */}
              {apprenticeSubstep === 'resolving' && (() => {
                const currentTp = tpsRequiringResolution[apprenticeResolvingTpIndex];
                const currentResolution = currentTp ? tpResolutions.find((r) => r.tpId === currentTp.id) : undefined;
                if (!currentTp || !currentResolution) return null;
                const tpRealmStatGains = new Set<Stat>(
                  currentTp.realmStatGain
                    ? characterBuilder.magicalRealms.flatMap((realm) => {
                      const stat = getStatForRealm(realm);
                      return stat ? [stat] : [];
                    })
                    : [],
                );
                const resError = validateTpResolution(currentTp, currentResolution, tpRealmStatGains);
                const updateResolution = (updater: (r: TpResolution) => TpResolution) => {
                  setTpResolutions((prev) => prev.map((r) => r.tpId === currentTp.id ? updater(r) : r));
                };
                return (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0 }}>{currentTp.name} — {tpCostMap.get(currentTp.id) ?? 0} DP</h4>
                      <span style={{ color: 'var(--muted)' }}>TP {apprenticeResolvingTpIndex + 1} of {tpsRequiringResolution.length}</span>
                    </div>

                    {currentTp.realmStatGain && characterBuilder.magicalRealms.length > 0 && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
                        <strong>Realm Stat Gain</strong>
                        <div style={{ color: 'var(--muted)', fontSize: '0.9em', marginTop: 4 }}>
                          This TP grants a stat gain roll for the following stats: {[...tpRealmStatGains].join(', ')}.
                        </div>
                      </div>
                    )}

                    {currentTp.statGainChoices && currentTp.statGainChoices.numChoices > 0 && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
                        <strong>Stat Gain Choices</strong>
                        <div style={{ color: 'var(--muted)', fontSize: '0.9em', marginBottom: 8 }}>
                          Choose {currentTp.statGainChoices.numChoices} stat{currentTp.statGainChoices.numChoices > 1 ? 's' : ''} to receive a gain roll.
                        </div>
                        <div style={{ display: 'grid', gap: 6 }}>
                          {Array.from({ length: currentTp.statGainChoices.numChoices }, (_, si) => {
                            const chosen = currentResolution.statGainChoices[si] ?? '';
                            const otherChosen = new Set<string>(currentResolution.statGainChoices.filter((s, i) => i !== si && s));
                            const opts = (currentTp.statGainChoices!.options as string[])
                              .filter((s) => !otherChosen.has(s) && !tpRealmStatGains.has(s as Stat))
                              .map((s) => ({ value: s, label: s }));
                            return (
                              <LabeledSelect
                                key={si}
                                label={`Stat ${si + 1}`}
                                value={chosen}
                                onChange={(v) => updateResolution((r) => ({
                                  ...r,
                                  statGainChoices: r.statGainChoices.map((s, i) => i === si ? v as Stat | '' : s),
                                }))}
                                options={opts}
                                placeholderOption="— Select stat —"
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(currentTp.skillRankChoices ?? []).some((c) => c.numChoices > 0) && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
                        <strong>Skill Rank Choices</strong>
                        <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
                          {(currentTp.skillRankChoices ?? []).map((choiceDef, gi) => {
                            if (choiceDef.numChoices <= 0) return null;
                            const allocs = currentResolution.skillRankChoices[gi] ?? [];
                            const totalAllocated = allocs.reduce((s, a) => s + a.ranks, 0);
                            const remainingRanks = choiceDef.value - totalAllocated;
                            const usedIds = new Set(allocs.map((a) => a.id).filter(Boolean));
                            const optionIds = new Set(choiceDef.options.map((o) => o.id));
                            return (
                              <div key={gi}>
                                <div style={{ color: 'var(--muted)', fontSize: '0.9em', marginBottom: 4 }}>
                                  Distribute {choiceDef.value} rank{choiceDef.value !== 1 ? 's' : ''} across up to {choiceDef.numChoices} skill{choiceDef.numChoices !== 1 ? 's' : ''}
                                  {remainingRanks !== 0 && <span style={{ color: remainingRanks > 0 ? 'var(--warning, #b96c00)' : '#b00020', marginLeft: 8, fontWeight: 600 }}>({remainingRanks > 0 ? `${remainingRanks} rank${remainingRanks !== 1 ? 's' : ''} unallocated` : `${Math.abs(remainingRanks)} rank${Math.abs(remainingRanks) !== 1 ? 's' : ''} over`})</span>}
                                </div>
                                <div style={{ display: 'grid', gap: 6 }}>
                                  {allocs.map((alloc, ai) => {
                                    const availableOpts = skills.filter((s) => optionIds.has(s.id) && (s.id === alloc.id || !usedIds.has(s.id))).map(toSkillRichOption);
                                    return (
                                      <div key={ai} style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                                        <div style={{ flex: 1 }}>
                                          <RichSelect
                                            label={`Skill ${ai + 1}`}
                                            value={alloc.id}
                                            onChange={(v) => updateResolution((r) => ({ ...r, skillRankChoices: r.skillRankChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, id: v, subcategory: '' })) }))}
                                            options={availableOpts}
                                            placeholderOption="— Select skill —"
                                          />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 4 }}>
                                          <button type="button" onClick={() => updateResolution((r) => ({ ...r, skillRankChoices: r.skillRankChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, ranks: a.ranks - 1 })) }))} disabled={alloc.ranks <= 1}>-</button>
                                          <span style={{ minWidth: 24, textAlign: 'center' }}>{alloc.ranks}</span>
                                          <button type="button" onClick={() => updateResolution((r) => ({ ...r, skillRankChoices: r.skillRankChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, ranks: a.ranks + 1 })) }))} disabled={remainingRanks <= 0}>+</button>
                                        </div>
                                        <button type="button" onClick={() => updateResolution((r) => ({ ...r, skillRankChoices: r.skillRankChoices.map((g, gIdx) => gIdx !== gi ? g : g.filter((_, aIdx) => aIdx !== ai)) }))} style={{ marginBottom: 4 }}>×</button>
                                      </div>
                                    );
                                  })}
                                </div>
                                {allocs.length < choiceDef.numChoices && remainingRanks > 0 && (
                                  <button type="button" style={{ marginTop: 4 }} onClick={() => updateResolution((r) => ({ ...r, skillRankChoices: r.skillRankChoices.map((g, gIdx) => gIdx !== gi ? g : [...g, { id: '', subcategory: '', ranks: 1 }]) }))}>+ Add skill</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(currentTp.categoryMultiSkillRankChoices ?? []).some((c) => c.numChoices > 0) && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
                        <strong>Category Skill Choices</strong>
                        <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
                          {(currentTp.categoryMultiSkillRankChoices ?? []).map((choiceDef, gi) => {
                            if (choiceDef.numChoices <= 0) return null;
                            const catName = categoryNameById.get(choiceDef.id) ?? choiceDef.id;
                            const catSkills = skillIdsByCategory.get(choiceDef.id) ?? [];
                            const allocs = currentResolution.categoryMultiSkillChoices[gi] ?? [];
                            const totalAllocated = allocs.reduce((s, a) => s + a.ranks, 0);
                            const remainingRanks = choiceDef.value - totalAllocated;
                            const usedIds = new Set(allocs.map((a) => a.id).filter(Boolean));
                            return (
                              <div key={gi}>
                                <div style={{ color: 'var(--muted)', fontSize: '0.9em', marginBottom: 4 }}>
                                  {catName}: distribute {choiceDef.value} rank{choiceDef.value !== 1 ? 's' : ''} across up to {choiceDef.numChoices} skill{choiceDef.numChoices !== 1 ? 's' : ''}
                                  {remainingRanks !== 0 && <span style={{ color: remainingRanks > 0 ? 'var(--warning, #b96c00)' : '#b00020', marginLeft: 8, fontWeight: 600 }}>({remainingRanks > 0 ? `${remainingRanks} rank${remainingRanks !== 1 ? 's' : ''} unallocated` : `${Math.abs(remainingRanks)} rank${Math.abs(remainingRanks) !== 1 ? 's' : ''} over`})</span>}
                                </div>
                                <div style={{ display: 'grid', gap: 6 }}>
                                  {allocs.map((alloc, ai) => {
                                    const availableOpts = catSkills.filter((s) => s.id === alloc.id || !usedIds.has(s.id)).map(toSkillRichOption);
                                    return (
                                      <div key={ai} style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                                        <div style={{ flex: 1 }}>
                                          <RichSelect
                                            label={`Skill ${ai + 1}`}
                                            value={alloc.id}
                                            onChange={(v) => updateResolution((r) => ({ ...r, categoryMultiSkillChoices: r.categoryMultiSkillChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, id: v, subcategory: '' })) }))}
                                            options={availableOpts}
                                            placeholderOption="— Select skill —"
                                          />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 4 }}>
                                          <button type="button" onClick={() => updateResolution((r) => ({ ...r, categoryMultiSkillChoices: r.categoryMultiSkillChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, ranks: a.ranks - 1 })) }))} disabled={alloc.ranks <= 1}>-</button>
                                          <span style={{ minWidth: 24, textAlign: 'center' }}>{alloc.ranks}</span>
                                          <button type="button" onClick={() => updateResolution((r) => ({ ...r, categoryMultiSkillChoices: r.categoryMultiSkillChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, ranks: a.ranks + 1 })) }))} disabled={remainingRanks <= 0}>+</button>
                                        </div>
                                        <button type="button" onClick={() => updateResolution((r) => ({ ...r, categoryMultiSkillChoices: r.categoryMultiSkillChoices.map((g, gIdx) => gIdx !== gi ? g : g.filter((_, aIdx) => aIdx !== ai)) }))} style={{ marginBottom: 4 }}>×</button>
                                      </div>
                                    );
                                  })}
                                </div>
                                {allocs.length < choiceDef.numChoices && remainingRanks > 0 && (
                                  <button type="button" style={{ marginTop: 4 }} onClick={() => updateResolution((r) => ({ ...r, categoryMultiSkillChoices: r.categoryMultiSkillChoices.map((g, gIdx) => gIdx !== gi ? g : [...g, { id: '', subcategory: '', ranks: 1 }]) }))}>+ Add skill</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(currentTp.groupMultiSkillRankChoices ?? []).some((c) => c.numChoices > 0) && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
                        <strong>Group Skill Choices</strong>
                        <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
                          {(currentTp.groupMultiSkillRankChoices ?? []).map((choiceDef, gi) => {
                            if (choiceDef.numChoices <= 0) return null;
                            const grpName = groups.find((g) => g.id === choiceDef.id)?.name ?? choiceDef.id;
                            const grpSkills = (categoryIdsByGroup.get(choiceDef.id) ?? []).flatMap((catId) => skillIdsByCategory.get(catId) ?? []);
                            const allocs = currentResolution.groupMultiSkillChoices[gi] ?? [];
                            const totalAllocated = allocs.reduce((s, a) => s + a.ranks, 0);
                            const remainingRanks = choiceDef.value - totalAllocated;
                            const usedIds = new Set(allocs.map((a) => a.id).filter(Boolean));
                            return (
                              <div key={gi}>
                                <div style={{ color: 'var(--muted)', fontSize: '0.9em', marginBottom: 4 }}>
                                  {grpName}: distribute {choiceDef.value} rank{choiceDef.value !== 1 ? 's' : ''} across up to {choiceDef.numChoices} skill{choiceDef.numChoices !== 1 ? 's' : ''}
                                  {remainingRanks !== 0 && <span style={{ color: remainingRanks > 0 ? 'var(--warning, #b96c00)' : '#b00020', marginLeft: 8, fontWeight: 600 }}>({remainingRanks > 0 ? `${remainingRanks} rank${remainingRanks !== 1 ? 's' : ''} unallocated` : `${Math.abs(remainingRanks)} rank${Math.abs(remainingRanks) !== 1 ? 's' : ''} over`})</span>}
                                </div>
                                <div style={{ display: 'grid', gap: 6 }}>
                                  {allocs.map((alloc, ai) => {
                                    const availableOpts = grpSkills.filter((s) => s.id === alloc.id || !usedIds.has(s.id)).map(toSkillRichOption);
                                    return (
                                      <div key={ai} style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                                        <div style={{ flex: 1 }}>
                                          <RichSelect
                                            label={`Skill ${ai + 1}`}
                                            value={alloc.id}
                                            onChange={(v) => updateResolution((r) => ({ ...r, groupMultiSkillChoices: r.groupMultiSkillChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, id: v, subcategory: '' })) }))}
                                            options={availableOpts}
                                            placeholderOption="— Select skill —"
                                          />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 4 }}>
                                          <button type="button" onClick={() => updateResolution((r) => ({ ...r, groupMultiSkillChoices: r.groupMultiSkillChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, ranks: a.ranks - 1 })) }))} disabled={alloc.ranks <= 1}>-</button>
                                          <span style={{ minWidth: 24, textAlign: 'center' }}>{alloc.ranks}</span>
                                          <button type="button" onClick={() => updateResolution((r) => ({ ...r, groupMultiSkillChoices: r.groupMultiSkillChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, ranks: a.ranks + 1 })) }))} disabled={remainingRanks <= 0}>+</button>
                                        </div>
                                        <button type="button" onClick={() => updateResolution((r) => ({ ...r, groupMultiSkillChoices: r.groupMultiSkillChoices.map((g, gIdx) => gIdx !== gi ? g : g.filter((_, aIdx) => aIdx !== ai)) }))} style={{ marginBottom: 4 }}>×</button>
                                      </div>
                                    );
                                  })}
                                </div>
                                {allocs.length < choiceDef.numChoices && remainingRanks > 0 && (
                                  <button type="button" style={{ marginTop: 4 }} onClick={() => updateResolution((r) => ({ ...r, groupMultiSkillChoices: r.groupMultiSkillChoices.map((g, gIdx) => gIdx !== gi ? g : [...g, { id: '', subcategory: '', ranks: 1 }]) }))}>+ Add skill</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(currentTp.groupCategoryAndSkillRankChoices ?? []).length > 0 && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
                        <strong>Group Category &amp; Skill Choices</strong>
                        <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
                          {(currentTp.groupCategoryAndSkillRankChoices ?? []).map((choiceDef, gi) => {
                            const slot = currentResolution.groupCategoryAndSkillChoices[gi] ?? { categoryId: '', skillId: '', subcategory: '' };
                            const grpName = groups.find((g) => g.id === choiceDef.id)?.name ?? choiceDef.id;
                            const isWeaponsGroup = choiceDef.id === 'SKILLGROUP_WEAPON';
                            const catsInGroup = categories.filter((c) => c.group === choiceDef.id).map((c) => ({ value: c.id, label: c.name }));
                            const skillsInSelectedCat = slot.categoryId ? (skillIdsByCategory.get(slot.categoryId) ?? []).map(toSkillRichOption) : [];
                            const weaponTypeOpts = slot.skillId && isWeaponsGroup ? (weaponTypeOptionsBySkillId.get(slot.skillId) ?? []) : [];
                            return (
                              <div key={gi} style={{ display: 'grid', gap: 6 }}>
                                <div style={{ color: 'var(--muted)', fontSize: '0.9em' }}>
                                  {grpName}: select a category and one skill from it — each receives {choiceDef.value} rank{choiceDef.value !== 1 ? 's' : ''}
                                </div>
                                <LabeledSelect
                                  label="Category"
                                  value={slot.categoryId}
                                  onChange={(v) => updateResolution((r) => ({
                                    ...r,
                                    groupCategoryAndSkillChoices: r.groupCategoryAndSkillChoices.map((s, i) => i !== gi ? s : { categoryId: v, skillId: '', subcategory: '' }),
                                  }))}
                                  options={catsInGroup}
                                  placeholderOption="— Select category —"
                                />
                                {slot.categoryId && (
                                  <RichSelect
                                    label="Skill"
                                    value={slot.skillId}
                                    onChange={(v) => updateResolution((r) => ({
                                      ...r,
                                      groupCategoryAndSkillChoices: r.groupCategoryAndSkillChoices.map((s, i) => i !== gi ? s : { ...s, skillId: v, subcategory: '' }),
                                    }))}
                                    options={skillsInSelectedCat}
                                    placeholderOption="— Select skill —"
                                  />
                                )}
                                {slot.skillId && isWeaponsGroup && weaponTypeOpts.length > 0 && (
                                  <LabeledSelect
                                    label="Weapon Type"
                                    value={slot.subcategory}
                                    onChange={(v) => updateResolution((r) => ({
                                      ...r,
                                      groupCategoryAndSkillChoices: r.groupCategoryAndSkillChoices.map((s, i) => i !== gi ? s : { ...s, subcategory: v }),
                                    }))}
                                    options={weaponTypeOpts}
                                    placeholderOption="— Select weapon type —"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(currentTp.spellListRanks ?? []).some((r) => r.numChoices > 0) && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
                        <strong>Spell List Choices</strong>
                        <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
                          {(currentTp.spellListRanks ?? []).filter((r) => r.numChoices > 0).map((choiceDef, gi) => {
                            const allocs = currentResolution.spellListChoices[gi] ?? [];
                            const totalAllocated = allocs.reduce((s, a) => s + a.ranks, 0);
                            const remainingRanks = choiceDef.value - totalAllocated;
                            const usedIds = new Set(allocs.map((a) => a.id).filter(Boolean));
                            const availableSlOpts = choiceDef.options.filter((slId) => slId).map(toSpellListRichOption);
                            return (
                              <div key={gi}>
                                <div style={{ color: 'var(--muted)', fontSize: '0.9em', marginBottom: 4 }}>
                                  Distribute {choiceDef.value} rank{choiceDef.value !== 1 ? 's' : ''} across up to {choiceDef.numChoices} spell list{choiceDef.numChoices !== 1 ? 's' : ''}
                                  {remainingRanks !== 0 && <span style={{ color: remainingRanks > 0 ? 'var(--warning, #b96c00)' : '#b00020', marginLeft: 8, fontWeight: 600 }}>({remainingRanks > 0 ? `${remainingRanks} rank${remainingRanks !== 1 ? 's' : ''} unallocated` : `${Math.abs(remainingRanks)} rank${Math.abs(remainingRanks) !== 1 ? 's' : ''} over`})</span>}
                                </div>
                                <div style={{ display: 'grid', gap: 6 }}>
                                  {allocs.map((alloc, ai) => {
                                    const filteredOpts = availableSlOpts.filter((o) => o.value === alloc.id || !usedIds.has(o.value));
                                    return (
                                      <div key={ai} style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                                        <div style={{ flex: 1 }}>
                                          <RichSelect
                                            label={`Spell List ${ai + 1}`}
                                            value={alloc.id}
                                            onChange={(v) => updateResolution((r) => ({ ...r, spellListChoices: r.spellListChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, id: v })) }))}
                                            options={filteredOpts}
                                            placeholderOption="— Select spell list —"
                                          />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 4 }}>
                                          <button type="button" onClick={() => updateResolution((r) => ({ ...r, spellListChoices: r.spellListChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, ranks: a.ranks - 1 })) }))} disabled={alloc.ranks <= 1}>-</button>
                                          <span style={{ minWidth: 24, textAlign: 'center' }}>{alloc.ranks}</span>
                                          <button type="button" onClick={() => updateResolution((r) => ({ ...r, spellListChoices: r.spellListChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, ranks: a.ranks + 1 })) }))} disabled={remainingRanks <= 0}>+</button>
                                        </div>
                                        <button type="button" onClick={() => updateResolution((r) => ({ ...r, spellListChoices: r.spellListChoices.map((g, gIdx) => gIdx !== gi ? g : g.filter((_, aIdx) => aIdx !== ai)) }))} style={{ marginBottom: 4 }}>×</button>
                                      </div>
                                    );
                                  })}
                                </div>
                                {allocs.length < choiceDef.numChoices && remainingRanks > 0 && (
                                  <button type="button" style={{ marginTop: 4 }} onClick={() => updateResolution((r) => ({ ...r, spellListChoices: r.spellListChoices.map((g, gIdx) => gIdx !== gi ? g : [...g, { id: '', ranks: 1 }]) }))}>+ Add spell list</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(currentTp.spellListCategoryRankChoices ?? []).some((c) => c.numChoices > 0) && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
                        <strong>Spell List Category Choices</strong>
                        <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
                          {(currentTp.spellListCategoryRankChoices ?? []).map((choiceDef, gi) => {
                            if (choiceDef.numChoices <= 0) return null;
                            const allocs = currentResolution.spellListCategoryChoices[gi] ?? [];
                            const totalAllocated = allocs.reduce((s, a) => s + a.ranks, 0);
                            const remainingRanks = choiceDef.value - totalAllocated;
                            const usedIds = new Set(allocs.map((a) => a.id).filter(Boolean));
                            const aggregatedSlOpts = choiceDef.options.flatMap((catId) =>
                              (characterBuilder.categorySpellLists.find((c) => c.category === catId)?.spellLists ?? [])
                                .map(toSpellListRichOption)
                            );
                            return (
                              <div key={gi}>
                                <div style={{ color: 'var(--muted)', fontSize: '0.9em', marginBottom: 4 }}>
                                  Distribute {choiceDef.value} rank{choiceDef.value !== 1 ? 's' : ''} across up to {choiceDef.numChoices} spell list{choiceDef.numChoices !== 1 ? 's' : ''}
                                  {remainingRanks !== 0 && <span style={{ color: remainingRanks > 0 ? 'var(--warning, #b96c00)' : '#b00020', marginLeft: 8, fontWeight: 600 }}>({remainingRanks > 0 ? `${remainingRanks} rank${remainingRanks !== 1 ? 's' : ''} unallocated` : `${Math.abs(remainingRanks)} rank${Math.abs(remainingRanks) !== 1 ? 's' : ''} over`})</span>}
                                </div>
                                <div style={{ display: 'grid', gap: 6 }}>
                                  {allocs.map((alloc, ai) => {
                                    const filteredOpts = aggregatedSlOpts.filter((o) => o.value === alloc.id || !usedIds.has(o.value));
                                    return (
                                      <div key={ai} style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                                        <div style={{ flex: 1 }}>
                                          <RichSelect
                                            label={`Spell List ${ai + 1}`}
                                            value={alloc.id}
                                            onChange={(v) => updateResolution((r) => ({ ...r, spellListCategoryChoices: r.spellListCategoryChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, id: v })) }))}
                                            options={filteredOpts}
                                            placeholderOption="— Select spell list —"
                                          />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 4 }}>
                                          <button type="button" onClick={() => updateResolution((r) => ({ ...r, spellListCategoryChoices: r.spellListCategoryChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, ranks: a.ranks - 1 })) }))} disabled={alloc.ranks <= 1}>-</button>
                                          <span style={{ minWidth: 24, textAlign: 'center' }}>{alloc.ranks}</span>
                                          <button type="button" onClick={() => updateResolution((r) => ({ ...r, spellListCategoryChoices: r.spellListCategoryChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, ranks: a.ranks + 1 })) }))} disabled={remainingRanks <= 0}>+</button>
                                        </div>
                                        <button type="button" onClick={() => updateResolution((r) => ({ ...r, spellListCategoryChoices: r.spellListCategoryChoices.map((g, gIdx) => gIdx !== gi ? g : g.filter((_, aIdx) => aIdx !== ai)) }))} style={{ marginBottom: 4 }}>×</button>
                                      </div>
                                    );
                                  })}
                                </div>
                                {allocs.length < choiceDef.numChoices && remainingRanks > 0 && (
                                  <button type="button" style={{ marginTop: 4 }} onClick={() => updateResolution((r) => ({ ...r, spellListCategoryChoices: r.spellListCategoryChoices.map((g, gIdx) => gIdx !== gi ? g : [...g, { id: '', ranks: 1 }]) }))}>+ Add spell list</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(currentTp.lifestyleCategorySkillChoices ?? []).some((c) => c.numChoices > 0) && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
                        <strong>Lifestyle Skill Choices</strong>
                        <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
                          {(currentTp.lifestyleCategorySkillChoices ?? []).map((choiceDef, gi) => {
                            if (choiceDef.numChoices <= 0) return null;
                            const chosen = currentResolution.lifestyleCategorySkillChoices[gi] ?? [];
                            const poolSkills = choiceDef.options.flatMap((catId) => skillIdsByCategory.get(catId) ?? []);
                            return (
                              <div key={gi}>
                                <div style={{ color: 'var(--muted)', fontSize: '0.9em', marginBottom: 4 }}>
                                  Choose {choiceDef.numChoices} skill{choiceDef.numChoices !== 1 ? 's' : ''} to gain Lifestyle development — these will be available at Lifestyle cost during extra options.
                                </div>
                                <div style={{ display: 'grid', gap: 4 }}>
                                  {Array.from({ length: choiceDef.numChoices }, (_, si) => {
                                    const val = chosen[si] ?? '';
                                    const usedOthers = new Set(chosen.filter((s, i) => i !== si && s));
                                    const opts = poolSkills.filter((s) => s.id === val || !usedOthers.has(s.id)).map(toSkillRichOption);
                                    return (
                                      <RichSelect
                                        key={si}
                                        label={`Skill ${si + 1}`}
                                        value={val}
                                        onChange={(v) => updateResolution((r) => ({
                                          ...r,
                                          lifestyleCategorySkillChoices: r.lifestyleCategorySkillChoices.map((g, gIdx) =>
                                            gIdx !== gi ? g : g.map((s, sIdx) => sIdx !== si ? s : v),
                                          ),
                                        }))}
                                        options={opts}
                                        placeholderOption="— Select skill —"
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(currentTp.languageChoices ?? []).some((c) => c.numChoices > 0) && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
                        <strong>Language Choices</strong>
                        <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
                          {(currentTp.languageChoices ?? []).map((choiceDef, gi) => {
                            if (choiceDef.numChoices <= 0) return null;
                            const allocs = currentResolution.languageChoices[gi] ?? [];
                            const totalAllocated = allocs.reduce((s, a) => s + a.spoken + a.written + a.somatic, 0);
                            const remainingRanks = choiceDef.value - totalAllocated;
                            const usedLangIds = new Set(allocs.map((a) => a.languageId).filter(Boolean));
                            const availableLangOpts = choiceDef.options
                              .filter((lId) => lId)
                              .map((lId) => ({ value: lId, label: languageNameById.get(lId) ?? lId }));
                            return (
                              <div key={gi}>
                                <div style={{ color: 'var(--muted)', fontSize: '0.9em', marginBottom: 4 }}>
                                  Distribute {choiceDef.value} rank{choiceDef.value !== 1 ? 's' : ''} across up to {choiceDef.numChoices} language{choiceDef.numChoices !== 1 ? 's' : ''}
                                  {remainingRanks !== 0 && <span style={{ color: remainingRanks > 0 ? 'var(--warning, #b96c00)' : '#b00020', marginLeft: 8, fontWeight: 600 }}>({remainingRanks > 0 ? `${remainingRanks} rank${remainingRanks !== 1 ? 's' : ''} unallocated` : `${Math.abs(remainingRanks)} rank${Math.abs(remainingRanks) !== 1 ? 's' : ''} over`})</span>}
                                </div>
                                <div style={{ display: 'grid', gap: 8 }}>
                                  {allocs.map((alloc, ai) => {
                                    const lang = languageById.get(alloc.languageId);
                                    const filteredOpts = availableLangOpts.filter((o) => o.value === alloc.languageId || !usedLangIds.has(o.value));
                                    return (
                                      <div key={ai} style={{ border: '1px solid var(--border)', borderRadius: 4, padding: 6 }}>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginBottom: 6 }}>
                                          <div style={{ flex: 1 }}>
                                            <LabeledSelect
                                              label={`Language ${ai + 1}`}
                                              value={alloc.languageId}
                                              onChange={(v) => updateResolution((r) => ({
                                                ...r,
                                                languageChoices: r.languageChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { languageId: v, spoken: 0, written: 0, somatic: 0 })),
                                              }))}
                                              options={filteredOpts}
                                              placeholderOption="— Select language —"
                                            />
                                          </div>
                                          <button type="button" onClick={() => updateResolution((r) => ({ ...r, languageChoices: r.languageChoices.map((g, gIdx) => gIdx !== gi ? g : g.filter((_, aIdx) => aIdx !== ai)) }))} style={{ marginBottom: 4 }}>×</button>
                                        </div>
                                        {alloc.languageId && (
                                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                            {(['spoken', 'written', 'somatic'] as const).map((ability) => {
                                              const enabled = ability === 'spoken' ? (lang?.isSpoken ?? false) : ability === 'written' ? (lang?.isWritten ?? false) : (lang?.isSomatic ?? false);
                                              if (!enabled) return null;
                                              const val = alloc[ability];
                                              return (
                                                <div key={ability} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                  <span style={{ textTransform: 'capitalize', minWidth: 52 }}>{ability}</span>
                                                  <button type="button" onClick={() => updateResolution((r) => ({ ...r, languageChoices: r.languageChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, [ability]: a[ability] - 1 })) }))} disabled={val <= 0}>-</button>
                                                  <span style={{ minWidth: 24, textAlign: 'center' }}>{val}</span>
                                                  <button type="button" onClick={() => updateResolution((r) => ({ ...r, languageChoices: r.languageChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, [ability]: a[ability] + 1 })) }))} disabled={remainingRanks <= 0}>+</button>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                {allocs.length < choiceDef.numChoices && (
                                  <button type="button" style={{ marginTop: 4 }} onClick={() => updateResolution((r) => ({ ...r, languageChoices: r.languageChoices.map((g, gIdx) => gIdx !== gi ? g : [...g, { languageId: '', spoken: 0, written: 0, somatic: 0 }]) }))}>+ Add language</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {resError && <div style={{ color: '#b00020' }}>{resError}</div>}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (apprenticeResolvingTpIndex === 0) {
                            setApprenticeSubstep('selecting');
                          } else {
                            setApprenticeResolvingTpIndex(apprenticeResolvingTpIndex - 1);
                          }
                        }}
                      >
                        ← {apprenticeResolvingTpIndex === 0 ? 'TP Selection' : 'Previous TP'}
                      </button>
                      <button
                        type="button"
                        disabled={!!resError}
                        onClick={() => {
                          if (apprenticeResolvingTpIndex + 1 >= tpsRequiringResolution.length) {
                            setApprenticeSubstep('purchasing');
                          } else {
                            setApprenticeResolvingTpIndex(apprenticeResolvingTpIndex + 1);
                          }
                        }}
                      >
                        {apprenticeResolvingTpIndex + 1 >= tpsRequiringResolution.length ? 'Finish Resolving →' : 'Next TP →'}
                      </button>
                    </div>
                  </div>
                );
              })()}


              {/* PURCHASING sub-step */}
              {apprenticeSubstep === 'purchasing' && (
                <>
                  {selectedApprenticeTrainingPackages.length > 0 && (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                      <h4 style={{ margin: '0 0 4px' }}>Selected Training Packages</h4>
                      {selectedApprenticeTrainingPackages.map((tp) => (
                        <div key={tp.id} style={{ color: 'var(--muted)' }}>
                          {tp.name}{tp.lifestyle ? ' (Lifestyle)' : ''} — {tpCostMap.get(tp.id) ?? 0} DP
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Stat Gain Rolls */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <h4 style={{ margin: '0 0 8px' }}>Stat Gain Rolls ({STAT_GAIN_DP_COST} DP each)</h4>
                    {apprenticeStatGains.length > 0 && (
                      <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                        {apprenticeStatGains.map((stat, i) => {
                          const availableOptions = STATS
                            .filter((s) => !apprenticeStatGainsUnavailable.has(s) && (s === stat || !apprenticeStatGains.includes(s)))
                            .map((s) => ({ value: s, label: s }));
                          return (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <LabeledSelect
                                label={`Stat Gain #${i + 1}`}
                                value={stat}
                                onChange={(v) => {
                                  setApprenticeStatGains((prev) => prev.map((s, idx) => (idx === i ? v as Stat : s)));
                                }}
                                options={availableOptions}
                              />
                              <button
                                type="button"
                                onClick={() => setApprenticeStatGains((prev) => prev.filter((_, idx) => idx !== i))}
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const nextStat = STATS.find((s) => !apprenticeStatGainsUnavailable.has(s) && !apprenticeStatGains.includes(s));
                        if (nextStat) setApprenticeStatGains((prev) => [...prev, nextStat]);
                      }}
                      disabled={
                        apprenticeDpRemaining < STAT_GAIN_DP_COST
                        || STATS.every((s) => apprenticeStatGainsUnavailable.has(s) || apprenticeStatGains.includes(s))
                      }
                    >
                      Add Stat Gain Roll
                    </button>
                  </div>

                  {/* Skill Rank Purchases */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <h4 style={{ margin: '0 0 8px' }}>Skill Ranks</h4>
                    {apprenticeSkillPurchases.length > 0 && (
                      <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
                        {apprenticeSkillPurchases.map((purchase, i) => {
                          const skillName = skillNameById.get(purchase.id) ?? purchase.id;
                          const categoryId = skillCategoryMap.get(purchase.id) ?? '';
                          const costElements = categoryCostMap.get(categoryId) ?? [];
                          const devType = skillDevTypeMap.get(purchase.id);
                          const tpRanksForSkill = tpGrantedSkillRankCounts.get(purchase.id) ?? 0;
                          const maxPurch = getSkillMaxDpPurchases(costElements, devType, tpRanksForSkill);
                          const ranksPerPurchase = getSkillRanksPerPurchase(devType);
                          const totalRanks = devType === 'Restricted' ? purchase.purchases : purchase.purchases * ranksPerPurchase;
                          const totalCost = getSkillDpCostWithTpOffset(costElements, devType, purchase.purchases, tpRanksForSkill);
                          const nextPurchaseCost = purchase.purchases < maxPurch
                            ? getSkillDpCostWithTpOffset(costElements, devType, purchase.purchases + 1, tpRanksForSkill) - totalCost
                            : 0;
                          const isWeaponGroupSkill = weaponGroupSkillIds.has(purchase.id);
                          const needsSubcategory = mandatorySubcategorySkillIds.has(purchase.id);
                          const existingSkillRanks = preApprenticeshipRanks.skillRanks
                            .filter((r) => r.id === purchase.id && (purchase.subcategory ? r.subcategory === purchase.subcategory : true))
                            .reduce((sum, r) => sum + r.value, 0);
                          const afterSkillRanks = existingSkillRanks + tpRanksForSkill + totalRanks;

                          return (
                            <div key={purchase.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <div>
                                    <strong>{skillName}</strong>
                                    <span style={{ color: 'var(--muted)', marginLeft: 6 }}>({categoryGroupNameById.get(categoryId) ?? categoryId})</span>
                                    {devType && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>[{devType}]</span>}
                                    <span style={{ color: 'var(--muted)', marginLeft: 6 }}>
                                      — {existingSkillRanks} → {afterSkillRanks} rank{afterSkillRanks !== 1 ? 's' : ''}, {totalCost} DP
                                    </span>
                                  </div>
                                  {needsSubcategory && (
                                    isWeaponGroupSkill ? (
                                      <LabeledSelect
                                        label="Weapon type"
                                        hideLabel={true}
                                        value={purchase.subcategory}
                                        onChange={(v) => setApprenticeSkillPurchases((prev) =>
                                          prev.map((p, idx) => idx === i ? { ...p, subcategory: v } : p),
                                        )}
                                        options={weaponTypeOptionsBySkillId.get(purchase.id) ?? []}
                                        placeholderOption="— Select weapon type —"
                                      />
                                    ) : (
                                      <LabeledInput
                                        label="Subcategory"
                                        hideLabel={true}
                                        value={purchase.subcategory}
                                        onChange={(v) => setApprenticeSkillPurchases((prev) =>
                                          prev.map((p, idx) => idx === i ? { ...p, subcategory: v } : p),
                                        )}
                                        placeholder="Subcategory"
                                      />
                                    )
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <button
                                    type="button"
                                    disabled={purchase.purchases <= 0}
                                    onClick={() => setApprenticeSkillPurchases((prev) =>
                                      prev.map((p, idx) => idx === i ? { ...p, purchases: p.purchases - 1 } : p),
                                    )}
                                  >
                                    -
                                  </button>
                                  <span style={{ minWidth: 20, textAlign: 'center' }}>{purchase.purchases}</span>
                                  <button
                                    type="button"
                                    disabled={purchase.purchases >= maxPurch || nextPurchaseCost > apprenticeDpRemaining}
                                    onClick={() => setApprenticeSkillPurchases((prev) =>
                                      prev.map((p, idx) => idx === i ? { ...p, purchases: p.purchases + 1 } : p),
                                    )}
                                  >
                                    +
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setApprenticeSkillPurchases((prev) => prev.filter((_, idx) => idx !== i))}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <RichSelect
                          label="Skill Category"
                          hideLabel={true}
                          value={apprenticeSkillCategoryFilter}
                          onChange={(v) => {
                            setApprenticeSkillCategoryFilter(v);
                            setApprenticeSkillPendingId('');
                            setApprenticeSkillPendingSubcategory('');
                          }}
                          options={apprenticeSkillCategoryOptions}
                          placeholderOption="— Filter by category —"
                        />
                        <RichSelect
                          label="Add Skill"
                          hideLabel={true}
                          value=""
                          onChange={(v) => {
                            if (!v) return;
                            if (mandatorySubcategorySkillIds.has(v)) {
                              setApprenticeSkillPendingId(v);
                              setApprenticeSkillPendingSubcategory('');
                            } else {
                              setApprenticeSkillPurchases((prev) => [...prev, { id: v, subcategory: '', purchases: 1 }]);
                              setApprenticeSkillPendingId('');
                              setApprenticeSkillPendingSubcategory('');
                            }
                          }}
                          options={apprenticeSkillOptions}
                          placeholderOption={apprenticeSkillCategoryFilter ? '— Select skill —' : '— Select a category first —'}
                        />
                      </div>
                      {apprenticeSkillPendingId && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontWeight: 500 }}>{skillNameById.get(apprenticeSkillPendingId) ?? apprenticeSkillPendingId}:</span>
                          {weaponGroupSkillIds.has(apprenticeSkillPendingId) ? (
                            <LabeledSelect
                              label="Weapon type"
                              hideLabel={true}
                              value={apprenticeSkillPendingSubcategory}
                              onChange={(v) => setApprenticeSkillPendingSubcategory(v)}
                              options={weaponTypeOptionsBySkillId.get(apprenticeSkillPendingId) ?? []}
                              placeholderOption="— Select weapon type —"
                            />
                          ) : (
                            <LabeledInput
                              label="Subcategory"
                              hideLabel={true}
                              value={apprenticeSkillPendingSubcategory}
                              onChange={(v) => setApprenticeSkillPendingSubcategory(v)}
                              placeholder="Subcategory"
                            />
                          )}
                          <button
                            type="button"
                            disabled={!apprenticeSkillPendingSubcategory.trim()}
                            onClick={() => {
                              setApprenticeSkillPurchases((prev) => [...prev, { id: apprenticeSkillPendingId, subcategory: apprenticeSkillPendingSubcategory.trim(), purchases: 1 }]);
                              setApprenticeSkillPendingId('');
                              setApprenticeSkillPendingSubcategory('');
                            }}
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setApprenticeSkillPendingId('');
                              setApprenticeSkillPendingSubcategory('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Category Rank Purchases */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <h4 style={{ margin: '0 0 8px' }}>Skill Category Ranks</h4>
                    {apprenticeCategoryPurchases.length > 0 && (
                      <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                        {apprenticeCategoryPurchases.map((purchase, i) => {
                          const catName = categoryNameById.get(purchase.id) ?? purchase.id;
                          const costElements = categoryCostMap.get(purchase.id) ?? [];
                          const tpRanksForCat = tpGrantedCategoryRankCounts.get(purchase.id) ?? 0;
                          const maxPurch = getCategoryMaxDpPurchases(costElements, tpRanksForCat);
                          const totalCost = getCategoryDpCostWithTpOffset(costElements, purchase.purchases, tpRanksForCat);
                          const nextCost = purchase.purchases < maxPurch
                            ? getCategoryDpCostWithTpOffset(costElements, purchase.purchases + 1, tpRanksForCat) - totalCost
                            : 0;
                          const existingCatRanks = preApprenticeshipRanks.categoryRanks
                            .filter((r) => r.id === purchase.id)
                            .reduce((sum, r) => sum + r.value, 0);
                          const afterCatRanks = existingCatRanks + tpRanksForCat + purchase.purchases;

                          return (
                            <div key={purchase.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 8 }}>
                              <span>
                                {catName}
                                <span style={{ color: 'var(--muted)', marginLeft: 6 }}>
                                  — {existingCatRanks} → {afterCatRanks} rank{afterCatRanks !== 1 ? 's' : ''}, {totalCost} DP
                                </span>
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  disabled={purchase.purchases <= 0}
                                  onClick={() => setApprenticeCategoryPurchases((prev) =>
                                    prev.map((p, idx) => idx === i ? { ...p, purchases: p.purchases - 1 } : p),
                                  )}
                                >
                                  -
                                </button>
                                <span style={{ minWidth: 20, textAlign: 'center' }}>{purchase.purchases}</span>
                                <button
                                  type="button"
                                  disabled={purchase.purchases >= maxPurch || nextCost > apprenticeDpRemaining}
                                  onClick={() => setApprenticeCategoryPurchases((prev) =>
                                    prev.map((p, idx) => idx === i ? { ...p, purchases: p.purchases + 1 } : p),
                                  )}
                                >
                                  +
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => setApprenticeCategoryPurchases((prev) => prev.filter((_, idx) => idx !== i))}
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <RichSelect
                      label="Add Category"
                      value=""
                      hideLabel={true}
                      onChange={(v) => {
                        if (v) {
                          setApprenticeCategoryPurchases((prev) => [...prev, { id: v, purchases: 1 }]);
                        }
                      }}
                      options={apprenticeCategoryOptions}
                      placeholderOption="— Add category —"
                    />
                  </div>

                  {/* Spell List Rank Purchases */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <h4 style={{ margin: '0 0 8px' }}>Spell List Ranks</h4>
                    {apprenticeSpellListPurchases.length > 0 && (
                      <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                        {apprenticeSpellListPurchases.map((purchase, i) => {
                          const slName = spellListNameById.get(purchase.id) ?? purchase.id;
                          const catEntry = characterBuilder.categorySpellLists.find((c) => c.spellLists.includes(purchase.id));
                          const costElements = catEntry ? (categoryCostMap.get(catEntry.category) ?? []) : [];
                          const tpRanksForSl = tpGrantedSpellListRankCounts.get(purchase.id) ?? 0;
                          const maxPurch = getCategoryMaxDpPurchases(costElements, tpRanksForSl);
                          const totalCost = getCategoryDpCostWithTpOffset(costElements, purchase.purchases, tpRanksForSl);
                          const nextCost = purchase.purchases < maxPurch
                            ? getCategoryDpCostWithTpOffset(costElements, purchase.purchases + 1, tpRanksForSl) - totalCost
                            : 0;
                          const existingSlRanks = preApprenticeshipRanks.spellListRanks
                            .filter((r) => r.id === purchase.id)
                            .reduce((sum, r) => sum + r.value, 0);
                          const afterSlRanks = existingSlRanks + tpRanksForSl + purchase.purchases;

                          return (
                            <div key={purchase.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 8 }}>
                              <span>
                                {slName}
                                <span style={{ color: 'var(--muted)', marginLeft: 6 }}>
                                  — {existingSlRanks} → {afterSlRanks} rank{afterSlRanks !== 1 ? 's' : ''}, {totalCost} DP
                                </span>
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  disabled={purchase.purchases <= 0}
                                  onClick={() => setApprenticeSpellListPurchases((prev) =>
                                    prev.map((p, idx) => idx === i ? { ...p, purchases: p.purchases - 1 } : p),
                                  )}
                                >
                                  -
                                </button>
                                <span style={{ minWidth: 20, textAlign: 'center' }}>{purchase.purchases}</span>
                                <button
                                  type="button"
                                  disabled={purchase.purchases >= maxPurch || nextCost > apprenticeDpRemaining}
                                  onClick={() => setApprenticeSpellListPurchases((prev) =>
                                    prev.map((p, idx) => idx === i ? { ...p, purchases: p.purchases + 1 } : p),
                                  )}
                                >
                                  +
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => setApprenticeSpellListPurchases((prev) => prev.filter((_, idx) => idx !== i))}
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {apprenticeAddingSpellList ? (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <RichSelect
                          label="Spell Category"
                          hideLabel={true}
                          value={apprenticeSelectedSpellCategory}
                          onChange={(v) => setApprenticeSelectedSpellCategory(v)}
                          options={apprenticeSpellCategoryOptions}
                          placeholderOption="— Select category —"
                        />
                        {apprenticeSelectedSpellCategory && apprenticeSpellListsInSelectedCategory.length > 0 && (
                          <RichSelect
                            label="Spell List"
                            hideLabel={true}
                            value=""
                            onChange={(v) => {
                              if (v) {
                                setApprenticeSpellListPurchases((prev) => [...prev, { id: v, purchases: 1 }]);
                                setApprenticeSelectedSpellCategory('');
                                setApprenticeAddingSpellList(false);
                              }
                            }}
                            options={apprenticeSpellListsInSelectedCategory.map((sl) => toSpellListRichOption(sl.id))}
                            placeholderOption="— Select spell list —"
                          />
                        )}
                        {apprenticeSelectedSpellCategory && apprenticeSpellListsInSelectedCategory.length === 0 && (
                          <div style={{ color: 'var(--muted)' }}>No more spell lists available in this category.</div>
                        )}
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setApprenticeAddingSpellList(false);
                              setApprenticeSelectedSpellCategory('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          apprenticeDpRemaining <= 0
                          || characterBuilder.categorySpellLists.every((c) =>
                            c.spellLists.every((slId) => apprenticeSpellListPurchases.some((p) => p.id === slId)),
                          )
                        }
                        onClick={() => setApprenticeAddingSpellList(true)}
                      >
                        Add Spell List
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (tpsRequiringResolution.length === 0) {
                          setApprenticeSubstep('selecting');
                        } else {
                          setApprenticeResolvingTpIndex(tpsRequiringResolution.length - 1);
                          setApprenticeSubstep('resolving');
                        }
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={async () => { if (await submitLevelUpgrade()) setStep('summary'); }}
                      disabled={applying || Boolean(errors.apprenticeship)}
                    >
                      {applying ? 'Applying…' : 'Complete Apprenticeship'}
                    </button>
                  </div>
                </>
              )}

              {errors.apprenticeship && <div style={{ color: '#b00020' }}>{errors.apprenticeship}</div>}
            </section>
          )}

          {step === 'summary' && (
            <section style={{ display: 'grid', gap: 12 }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                <h4 style={{ margin: '0 0 8px' }}>Summary</h4>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Name: {characterName || 'None'}</li>
                  <li>Sex: {characterBuilder.male ? 'Male' : 'Female'}</li>
                  <li>Race: {race?.name ?? raceId}</li>
                  <li>Height: {characterBuilder.height > 0 ? `${Math.floor(characterBuilder.height / 12)}' ${characterBuilder.height % 12}"` : 'Not generated'}</li>
                  <li>Weight: {characterBuilder.weight > 0 ? `${characterBuilder.weight} lbs` : 'Not generated'}</li>
                  <li>Build: {characterBuilder.buildDescription || 'Not generated'}</li>
                  <li>Expected Lifespan: {characterBuilder.lifespan > 0 ? `${characterBuilder.lifespan} years` : 'Not generated'}</li>
                  <li>Culture: {culture?.name ?? cultureId}</li>
                  <li>Profession: {profession?.name ?? professionId}</li>
                  <li>Realms: {selectedRealms.join(', ') || 'None'}</li>
                  <li>Prime Stats: {primeStats.join(', ') || 'None'}</li>
                  <li>Training packages: {selectedApprenticeTrainingPackages.length > 0 ? selectedApprenticeTrainingPackages.map((tp) => tp.name).join(', ') : 'None'}</li>
                  <li>DP spent: {apprenticeTotalDpSpent} / {characterBuilder.developmentPoints}</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={resetWorkflow}>
                  New Character
                </button>
              </div>
            </section>
          )}

          {step !== 'summary' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={goPrev} disabled={step === 'primary'}>Back</button>
              <button type="button" onClick={goNext} disabled={!canGoNext || savingPrimaryDefinition || savingInitialChoices || savingStats || savingPhysique || savingHobbyChoices || savingBackgroundChoices}>Next</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
