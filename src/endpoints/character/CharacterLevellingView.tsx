import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchLanguages,
  fetchSkillCategories,
  fetchSkillGroups,
  fetchSkills,
  fetchSpellLists,
  fetchTrainingPackages,
  fetchWeaponTypes,
  initiateCharacterLevelUp,
  levelUpCharacter,
} from '../../api';

import {
  LabeledInput,
  LabeledSelect,
  RichOptionLabel,
  RichSelect,
  type RichSelectOption,
  Spinner,
  useToast,
} from '../../components';

import type {
  Character,
  CharacterLeveller,
  Language,
  Skill,
  SkillCategory,
  SkillGroup,
  SpellList,
  TrainingPackage,
  WeaponType,
} from '../../types';

import { STATS, getStatForRealm, type SkillDevelopmentType, type Stat } from '../../types/enum';

/* ------------------------------------------------------------------ */
/* Local types                                                         */
/* ------------------------------------------------------------------ */

type LevellingSkillPurchase = {
  id: string;
  subcategory: string;
  purchases: number;
};

type LevellingCategoryPurchase = {
  id: string;
  purchases: number;
};

type LevellingSpellListPurchase = {
  id: string;
  purchases: number;
};

type LevellingLanguagePurchase = {
  languageId: string;
  spokenBase: number;
  writtenBase: number;
  somaticBase: number;
  spoken: number;
  written: number;
  somatic: number;
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

type LevellingSubstep = 'selecting' | 'resolving' | 'purchasing';

/* ------------------------------------------------------------------ */
/* Pure helper functions (shared logic with CharacterCreationView)     */
/* ------------------------------------------------------------------ */

const STAT_GAIN_DP_COST = 8;

function parseCostString(cost: string): number[] {
  if (!cost) return [];
  return cost.split(':').map(Number).filter((n) => !isNaN(n) && n >= 0);
}

function skillChoiceKey(id: string, subcategory?: string | undefined): string {
  return subcategory?.trim() ? `${id}::${subcategory.trim()}` : id;
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

function validateTpResolution(
  tp: TrainingPackage,
  resolution: TpResolution,
  excludedStats: ReadonlySet<Stat> = new Set(),
): string | undefined {
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

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export interface CharacterLevellingViewProps {
  character: Character;
  onFinish: (updated: Character) => void;
  onCancel?: () => void;
}

export default function CharacterLevellingView({
  character,
  onFinish,
  onCancel,
}: CharacterLevellingViewProps) {
  const toast = useToast();

  /* ---------------------------------------------------------------- */
  /* Reference data loading                                           */
  /* ---------------------------------------------------------------- */

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [groups, setGroups] = useState<SkillGroup[]>([]);
  const [spellLists, setSpellLists] = useState<SpellList[]>([]);
  const [trainingPackages, setTrainingPackages] = useState<TrainingPackage[]>([]);
  const [weaponTypes, setWeaponTypes] = useState<WeaponType[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);

  /** CharacterLeveller returned by the initial levelup call – contains trainingPackageCosts. */
  const [leveller, setLeveller] = useState<CharacterLeveller | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [
          skillData,
          categoryData,
          groupData,
          spellListData,
          tpData,
          weaponTypeData,
          languageData,
          levellerData,
        ] = await Promise.all([
          fetchSkills(),
          fetchSkillCategories(),
          fetchSkillGroups(),
          fetchSpellLists(),
          fetchTrainingPackages(),
          fetchWeaponTypes(),
          fetchLanguages(),
          initiateCharacterLevelUp(character.id),
        ]);

        if (cancelled) return;
        setSkills(skillData);
        setCategories(categoryData);
        setGroups(groupData);
        setSpellLists(spellListData);
        setTrainingPackages(tpData);
        setWeaponTypes(weaponTypeData);
        setLanguages(languageData);
        setLeveller(levellerData);
      } catch (e) {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [character.id]);

  /* ---------------------------------------------------------------- */
  /* Levelling workflow state                                         */
  /* ---------------------------------------------------------------- */

  const [substep, setSubstep] = useState<LevellingSubstep>('selecting');
  const [resolvingTpIndex, setResolvingTpIndex] = useState(0);
  const [tpResolutions, setTpResolutions] = useState<TpResolution[]>([]);

  const [selectedTpIds, setSelectedTpIds] = useState<string[]>([]);
  const [statGains, setStatGains] = useState<Stat[]>([]);
  const [skillPurchases, setSkillPurchases] = useState<LevellingSkillPurchase[]>([]);
  const [skillCategoryFilter, setSkillCategoryFilter] = useState('');
  const [skillPendingId, setSkillPendingId] = useState('');
  const [skillPendingSubcategory, setSkillPendingSubcategory] = useState('');
  const [languagePurchases, setLanguagePurchases] = useState<LevellingLanguagePurchase[]>([]);
  const [categoryPurchases, setCategoryPurchases] = useState<LevellingCategoryPurchase[]>([]);
  const [spellListPurchases, setSpellListPurchases] = useState<LevellingSpellListPurchase[]>([]);
  const [selectedSpellCategory, setSelectedSpellCategory] = useState('');
  const [addingSpellList, setAddingSpellList] = useState(false);

  const [applying, setApplying] = useState(false);
  const [validationError, setValidationError] = useState<string | undefined>(undefined);

  const [showDescriptions, setShowDescriptions] = useState(false);

  /* ---------------------------------------------------------------- */
  /* Derived lookup maps from character data                          */
  /* ---------------------------------------------------------------- */

  /** category id → cost elements array (from character's existing category data) */
  const categoryCostMap = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const cat of character.categories) {
      map.set(cat.id, parseCostString(cat.developmentCost));
    }
    return map;
  }, [character.categories]);

  /** skill id → SkillDevelopmentType (from character's current skill data) */
  const skillDevTypeMap = useMemo(() => {
    const map = new Map<string, SkillDevelopmentType>();
    for (const s of character.skills) {
      if (!map.has(s.skillData.id)) {
        map.set(s.skillData.id, s.developmentType);
      }
    }
    return map;
  }, [character.skills]);

  /** training package id → DP cost (populated by server on initial levelup call) */
  const tpCostMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of leveller?.trainingPackageCosts ?? []) {
      map.set(row.id, row.value);
    }
    return map;
  }, [leveller]);

  /** pre-levelling skill ranks keyed by skillChoiceKey */
  const preLevellingSkillRanks = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of character.skills) {
      const key = skillChoiceKey(s.skillData.id, s.skillData.subcategory);
      map.set(key, (map.get(key) ?? 0) + s.ranks);
    }
    return map;
  }, [character.skills]);

  /** pre-levelling category ranks keyed by category id */
  const preLevellingCategoryRanks = useMemo(() => {
    const map = new Map<string, number>();
    for (const cat of character.categories) {
      map.set(cat.id, (map.get(cat.id) ?? 0) + cat.ranks);
    }
    return map;
  }, [character.categories]);

  /** pre-levelling spell list ranks keyed by spell list id */
  const preLevellingSpellListRanks = useMemo(() => {
    const map = new Map<string, number>();
    for (const sl of character.spellLists ?? []) {
      map.set(sl.id, sl.ranks);
    }
    return map;
  }, [character.spellLists]);

  /* ---------------------------------------------------------------- */
  /* Derived lookup maps from reference data                          */
  /* ---------------------------------------------------------------- */

  const skillNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of skills) map.set(s.id, s.name);
    return map;
  }, [skills]);

  const skillCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of skills) map.set(s.id, s.category);
    return map;
  }, [skills]);

  const skillIdsByCategory = useMemo(() => {
    const map = new Map<string, Skill[]>();
    for (const s of skills) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [skills]);

  const categoryIdsByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const cat of categories) {
      const list = map.get(cat.group) ?? [];
      list.push(cat.id);
      map.set(cat.group, list);
    }
    return map;
  }, [categories]);

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) map.set(g.id, g.name);
    return map;
  }, [groups]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      const groupName = groupNameById.get(c.group) ?? c.group;
      map.set(c.id, `(${groupName}) - ${c.name}`);
    }
    return map;
  }, [categories, groupNameById]);

  const categoryGroupNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.id, groupNameById.get(c.group) ?? c.group);
    return map;
  }, [categories, groupNameById]);

  const spellListNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const sl of spellLists) map.set(sl.id, sl.name);
    return map;
  }, [spellLists]);

  /** Global reverse map: spellListId → categoryId, derived from character's spell list categories */
  const spellListCategoryById = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of character.spellListCategories) {
      for (const slId of entry.spellLists) map.set(slId, entry.category);
    }
    return map;
  }, [character.spellListCategories]);

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

  const mandatorySubcategorySkillIds = useMemo(
    () => new Set(skills.filter((s) => s.mandatorySubcategory).map((s) => s.id)),
    [skills],
  );

  const languageSkillIds = useMemo(
    () => new Set(skills.filter((s) => s.name.trim().toLowerCase() === 'languages').map((s) => s.id)),
    [skills],
  );

  const communicationCategoryRanks = useMemo(() => {
    const base = character.categories.find((c) => c.id === 'SKILLCATEGORY_COMMUNICATION')?.ranks ?? 0;
    const purchased = categoryPurchases.find((p) => p.id === 'SKILLCATEGORY_COMMUNICATION')?.purchases ?? 0;
    return base + purchased;
  }, [character.categories, categoryPurchases]);

  const currentLanguageRanksById = useMemo(() => {
    const map = new Map<string, { spoken: number; written: number; somatic: number }>();
    for (const l of character.languages) {
      map.set(l.id, { spoken: l.spokenRanks, written: l.writtenRanks, somatic: l.somaticRanks });
    }
    return map;
  }, [character.languages]);

  const languageSelectOptions = useMemo(
    () => languages
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((l) => ({ value: l.id, label: l.name })),
    [languages],
  );

  const weaponTypeOptionsBySkillId = useMemo(() => {
    const map = new Map<string, Array<{ value: string; label: string }>>();
    for (const row of weaponTypes) {
      const list = map.get(row.skill) ?? [];
      list.push({ value: row.id, label: row.name });
      map.set(row.skill, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.label.localeCompare(b.label));
    return map;
  }, [weaponTypes]);

  const weaponGroupSkillIds = useMemo(() => {
    const weaponCategoryIds = new Set(
      categories
        .filter((c) => c.group === 'SKILLGROUP_WEAPON')
        .map((c) => c.id),
    );
    return new Set(skills.filter((s) => weaponCategoryIds.has(s.category)).map((s) => s.id));
  }, [categories, skills]);

  /* ---------------------------------------------------------------- */
  /* Training package filtering                                       */
  /* ---------------------------------------------------------------- */

  const availableTrainingPackages = useMemo(() => {
    const raceId = character.race;
    const raceFiltered = trainingPackages.filter((tp) => {
      const races = Array.isArray(tp.races) ? tp.races : [];
      return races.length === 0 || races.includes(raceId);
    });
    return raceFiltered;
  }, [trainingPackages, character.race]);

  const selectedTrainingPackages = useMemo(
    () => selectedTpIds
      .map((id) => availableTrainingPackages.find((tp) => tp.id === id))
      .filter((tp): tp is TrainingPackage => tp !== undefined),
    [availableTrainingPackages, selectedTpIds],
  );

  const selectedLifestyleTpId = useMemo(
    () => selectedTpIds.find((id) => availableTrainingPackages.find((tp) => tp.id === id)?.lifestyle) ?? null,
    [selectedTpIds, availableTrainingPackages],
  );

  const tpsRequiringResolution = useMemo(
    () => selectedTrainingPackages.filter(tpHasChoices),
    [selectedTrainingPackages],
  );

  /* ---------------------------------------------------------------- */
  /* DP cost calculations                                             */
  /* ---------------------------------------------------------------- */

  const tpGrantedSkillRankCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const tp of selectedTrainingPackages) {
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
  }, [selectedTrainingPackages, tpResolutions]);

  const tpGrantedCategoryRankCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const tp of selectedTrainingPackages) {
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
  }, [selectedTrainingPackages, tpResolutions]);

  const tpGrantedSpellListRankCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const tp of selectedTrainingPackages) {
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
  }, [selectedTrainingPackages, tpResolutions]);

  const statGainsUnavailable = useMemo((): Set<Stat> => {
    const claimed = new Set<Stat>();
    for (const tp of selectedTrainingPackages) {
      for (const stat of tp.statGains ?? []) claimed.add(stat);
      if (tp.realmStatGain) {
        for (const realm of character.magicalRealms) {
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
  }, [selectedTrainingPackages, tpResolutions, character.magicalRealms]);

  const tpDpCost = useMemo(
    () => selectedTpIds.reduce((total, id) => total + (tpCostMap.get(id) ?? 0), 0),
    [selectedTpIds, tpCostMap],
  );

  const statGainDpCost = statGains.length * STAT_GAIN_DP_COST;

  const skillDpCost = useMemo(
    () => skillPurchases.reduce((total, p) => {
      const catId = skillCategoryMap.get(p.id);
      if (!catId) return total;
      const costElements = categoryCostMap.get(catId) ?? [];
      const devType = skillDevTypeMap.get(p.id);
      const tpRanks = tpGrantedSkillRankCounts.get(p.id) ?? 0;
      return total + getSkillDpCostWithTpOffset(costElements, devType, p.purchases, tpRanks);
    }, 0),
    [skillPurchases, skillCategoryMap, categoryCostMap, skillDevTypeMap, tpGrantedSkillRankCounts],
  );

  const categoryDpCost = useMemo(
    () => categoryPurchases.reduce((total, p) => {
      const costElements = categoryCostMap.get(p.id) ?? [];
      const tpRanks = tpGrantedCategoryRankCounts.get(p.id) ?? 0;
      return total + getCategoryDpCostWithTpOffset(costElements, p.purchases, tpRanks);
    }, 0),
    [categoryPurchases, categoryCostMap, tpGrantedCategoryRankCounts],
  );

  const spellListDpCost = useMemo(
    () => spellListPurchases.reduce((total, p) => {
      const catEntry = character.spellListCategories.find((c) => c.spellLists.includes(p.id));
      if (!catEntry) return total;
      const costElements = categoryCostMap.get(catEntry.category) ?? [];
      const tpRanks = tpGrantedSpellListRankCounts.get(p.id) ?? 0;
      return total + getCategoryDpCostWithTpOffset(costElements, p.purchases, tpRanks);
    }, 0),
    [spellListPurchases, character.spellListCategories, categoryCostMap, tpGrantedSpellListRankCounts],
  );

  const languageDpCostPerRank = useMemo(() => {
    const langSkillId = [...languageSkillIds][0];
    if (!langSkillId) return 0;
    const catId = skillCategoryMap.get(langSkillId);
    if (!catId) return 0;
    const costElements = categoryCostMap.get(catId) ?? [];
    const devType = skillDevTypeMap.get(langSkillId);
    return getSkillDpCostWithTpOffset(costElements, devType, 1, 0);
  }, [languageSkillIds, skillCategoryMap, categoryCostMap, skillDevTypeMap]);

  const languageDpCost = useMemo(
    () => languagePurchases.reduce((total, lp) => {
      const newRanks = (lp.spoken - lp.spokenBase) + (lp.written - lp.writtenBase) + (lp.somatic - lp.somaticBase);
      return total + Math.max(0, newRanks) * languageDpCostPerRank;
    }, 0),
    [languagePurchases, languageDpCostPerRank],
  );

  const totalDpSpent = tpDpCost + statGainDpCost + skillDpCost + categoryDpCost + spellListDpCost + languageDpCost;
  const dpRemaining = character.developmentPoints - totalDpSpent;

  /* ---------------------------------------------------------------- */
  /* Rich option helpers                                              */
  /* ---------------------------------------------------------------- */

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

  const toSkillRichOption = useCallback((s: { id: string; name: string; category: string }): RichSelectOption => {
    const catName = categoryNameById.get(s.category);
    return {
      value: s.id,
      label: <RichOptionLabel primary={s.name} {...(catName ? { secondary: catName } : {})} />,
      searchText: catName ? `${s.name} — ${catName}` : s.name,
    };
  }, [categoryNameById]);

  /* ---------------------------------------------------------------- */
  /* Select option lists                                              */
  /* ---------------------------------------------------------------- */

  const tpOptions = useMemo((): RichSelectOption[] => {
    const selectedSet = new Set(selectedTpIds);
    return availableTrainingPackages
      .filter((tp) => {
        if (selectedSet.has(tp.id)) return false;
        if (tp.lifestyle && selectedLifestyleTpId !== null) return false;
        const cost = tpCostMap.get(tp.id) ?? 0;
        if (cost > dpRemaining) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((tp): RichSelectOption => {
        const cost = tpCostMap.get(tp.id) ?? '?';
        const secondary = tp.lifestyle ? `(Lifestyle) — ${cost} DP` : `${cost} DP`;
        return {
          value: tp.id,
          label: <RichOptionLabel primary={tp.name} secondary={secondary} />,
          searchText: `${tp.name} ${secondary}`,
          title: showDescriptions && tp.description ? tp.description : undefined,
        };
      });
  }, [availableTrainingPackages, selectedTpIds, selectedLifestyleTpId, tpCostMap, dpRemaining, showDescriptions]);

  const availableSkills = useMemo(() => {
    const selectedSet = new Set(skillPurchases.map((p) => p.id));
    return skills.filter((s) => {
      if (selectedSet.has(s.id)) return false;
      if (languageSkillIds.has(s.id)) return true;
      const costElements = categoryCostMap.get(s.category) ?? [];
      const devType = skillDevTypeMap.get(s.id);
      const tpRanks = tpGrantedSkillRankCounts.get(s.id) ?? 0;
      return getSkillMaxDpPurchases(costElements, devType, tpRanks) > 0;
    });
  }, [skills, skillPurchases, categoryCostMap, skillDevTypeMap, tpGrantedSkillRankCounts, languageSkillIds]);

  const skillCategoryOptions = useMemo((): RichSelectOption[] => {
    const catIds = new Set(availableSkills.map((s) => s.category));
    return Array.from(catIds)
      .map((id): RichSelectOption => {
        const costElements = categoryCostMap.get(id) ?? [];
        const firstRankCost = getSkillDpCostWithTpOffset(costElements, undefined, 1, 0);
        const name = categoryNameById.get(id) ?? id;
        return {
          value: id,
          label: <RichOptionLabel primary={name} secondary={`${firstRankCost} DP`} />,
          searchText: `${name} — ${firstRankCost} DP`,
        };
      })
      .sort((a, b) => (a.searchText ?? '').localeCompare(b.searchText ?? ''));
  }, [availableSkills, categoryNameById, categoryCostMap]);

  const skillOptions = useMemo((): RichSelectOption[] => {
    return availableSkills
      .filter((s) => !skillCategoryFilter || s.category === skillCategoryFilter)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s): RichSelectOption => {
        const costElements = categoryCostMap.get(s.category) ?? [];
        const devType = skillDevTypeMap.get(s.id);
        const tpRanks = tpGrantedSkillRankCounts.get(s.id) ?? 0;
        const nextRankCost = getSkillDpCostWithTpOffset(costElements, devType, 1, tpRanks);
        const secondary = devType ? `${devType} — ${nextRankCost} DP` : `${nextRankCost} DP`;
        return {
          value: s.id,
          label: <RichOptionLabel primary={s.name} secondary={secondary} />,
          searchText: `${s.name} ${secondary}`,
        };
      });
  }, [availableSkills, skillCategoryFilter, categoryCostMap, skillDevTypeMap, tpGrantedSkillRankCounts]);

  const categoryOptions = useMemo((): RichSelectOption[] => {
    const selectedSet = new Set(categoryPurchases.map((p) => p.id));
    return categories
      .filter((c) => {
        if (selectedSet.has(c.id)) return false;
        const costElements = categoryCostMap.get(c.id) ?? [];
        const tpRanks = tpGrantedCategoryRankCounts.get(c.id) ?? 0;
        return getCategoryMaxDpPurchases(costElements, tpRanks) > 0;
      })
      .sort((a, b) => (categoryNameById.get(a.id) ?? a.id).localeCompare(categoryNameById.get(b.id) ?? b.id))
      .map((c): RichSelectOption => {
        const costElements = categoryCostMap.get(c.id) ?? [];
        const tpRanks = tpGrantedCategoryRankCounts.get(c.id) ?? 0;
        const nextRankCost = getCategoryDpCostWithTpOffset(costElements, 1, tpRanks);
        const baseLabel = categoryNameById.get(c.id) ?? c.id;
        return {
          value: c.id,
          label: <RichOptionLabel primary={baseLabel} secondary={`${nextRankCost} DP`} />,
          searchText: `${baseLabel} — ${nextRankCost} DP`,
        };
      });
  }, [categories, categoryPurchases, categoryCostMap, categoryNameById, tpGrantedCategoryRankCounts]);

  const spellCategoryOptions = useMemo((): RichSelectOption[] =>
    character.spellListCategories.map((c): RichSelectOption => {
      const costElements = categoryCostMap.get(c.category) ?? [];
      const nextRankCost = getCategoryDpCostWithTpOffset(costElements, 1, 0);
      const catName = categoryNameById.get(c.category) ?? c.category;
      return {
        value: c.category,
        label: <RichOptionLabel primary={catName} secondary={`${nextRankCost} DP / rank`} />,
        searchText: `${catName} — ${nextRankCost} DP / rank`,
      };
    }).sort((a, b) => (a.searchText ?? '').localeCompare(b.searchText ?? '')),
    [character.spellListCategories, categoryNameById, categoryCostMap],
  );

  const spellListsInSelectedCategory = useMemo(() => {
    if (!selectedSpellCategory) return [];
    const catEntry = character.spellListCategories.find((c) => c.category === selectedSpellCategory);
    if (!catEntry) return [];
    const purchasedIds = new Set(spellListPurchases.map((p) => p.id));
    return catEntry.spellLists
      .filter((slId) => !purchasedIds.has(slId))
      .map((slId) => ({ id: slId, name: spellListNameById.get(slId) ?? slId }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedSpellCategory, character.spellListCategories, spellListNameById, spellListPurchases]);

  /* ---------------------------------------------------------------- */
  /* Sync TP resolutions when selected TPs change                     */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    setTpResolutions((prev) => {
      const resMap = new Map(prev.map((r) => [r.tpId, r]));
      return selectedTrainingPackages.map((tp) => resMap.get(tp.id) ?? createEmptyTpResolution(tp));
    });
  }, [selectedTrainingPackages]);

  /** Remove stat gains that are no longer available */
  useEffect(() => {
    if (statGainsUnavailable.size === 0) return;
    setStatGains((prev) => prev.filter((s) => !statGainsUnavailable.has(s)));
  }, [statGainsUnavailable]);

  /* ---------------------------------------------------------------- */
  /* Validation                                                       */
  /* ---------------------------------------------------------------- */

  const validate = (): string | undefined => {
    if (totalDpSpent > character.developmentPoints) {
      return `Development points overspent by ${totalDpSpent - character.developmentPoints}.`;
    }
    if (tpsRequiringResolution.length > 0 && substep !== 'purchasing') {
      return 'Resolve all training package choices before completing level-up.';
    }
    for (const tp of tpsRequiringResolution) {
      const res = tpResolutions.find((r) => r.tpId === tp.id);
      if (!res) return `Training package choices not complete for ${tp.name}.`;
      const resError = validateTpResolution(tp, res);
      if (resError) return resError;
    }
    let lifestyleCount = 0;
    for (const tpId of selectedTpIds) {
      if (availableTrainingPackages.find((t) => t.id === tpId)?.lifestyle) lifestyleCount++;
    }
    if (lifestyleCount > 1) return 'Only one lifestyle training package may be selected.';
    for (const p of skillPurchases) {
      if (p.purchases <= 0) continue;
      const skillName = skillNameById.get(p.id) ?? p.id;
      if (weaponGroupSkillIds.has(p.id) && p.subcategory) {
        const validWeaponTypes = weaponTypeOptionsBySkillId.get(p.id) ?? [];
        if (!validWeaponTypes.some((wt) => wt.value === p.subcategory)) {
          return `Skill: invalid weapon type selected for ${skillName}.`;
        }
      }
      if (!weaponGroupSkillIds.has(p.id) && mandatorySubcategorySkillIds.has(p.id) && !p.subcategory.trim()) {
        return `Skill: enter subcategory for ${skillName}.`;
      }
      if (weaponGroupSkillIds.has(p.id) && mandatorySubcategorySkillIds.has(p.id) && !p.subcategory) {
        return `Skill: select weapon type for ${skillName}.`;
      }
    }
    return undefined;
  };

  /* ---------------------------------------------------------------- */
  /* Submit                                                           */
  /* ---------------------------------------------------------------- */

  const submit = async () => {
    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(undefined);
    setApplying(true);

    try {
      /* Aggregate stat gains from TPs + TP choices + DP purchases */
      const totalStatGains: Stat[] = [];
      for (const tp of selectedTrainingPackages) {
        for (const stat of tp.statGains ?? []) totalStatGains.push(stat);
        const res = tpResolutions.find((r) => r.tpId === tp.id);
        if (res) {
          for (const stat of res.statGainChoices) {
            if (stat) totalStatGains.push(stat);
          }
        }
      }
      totalStatGains.push(...statGains);

      /* Aggregate skill ranks */
      const totalSkillsByKey = new Map<string, { id: string; subcategory?: string; ranks: number }>();
      const addSkillRanks = (id: string, subcategory: string | undefined, ranks: number) => {
        if (!id || ranks <= 0) return;
        const norm = subcategory?.trim() || undefined;
        const key = skillChoiceKey(id, norm);
        const existing = totalSkillsByKey.get(key);
        if (existing) {
          existing.ranks += ranks;
        } else {
          totalSkillsByKey.set(key, { id, ...(norm ? { subcategory: norm } : {}), ranks });
        }
      };
      // Start from pre-levelling ranks
      for (const [key, ranks] of preLevellingSkillRanks) {
        const [id, subcategory] = key.includes('::') ? key.split('::') : [key, undefined];
        addSkillRanks(id, subcategory, ranks);
      }
      // Add TP-granted ranks
      for (const tp of selectedTrainingPackages) {
        for (const rank of tp.skillRanks ?? []) {
          addSkillRanks(rank.id, rank.subcategory, rank.value);
        }
        const res = tpResolutions.find((r) => r.tpId === tp.id);
        if (res) {
          for (const gi of (tp.skillRankChoices ?? []).keys()) {
            for (const alloc of res.skillRankChoices[gi] ?? []) {
              if (alloc.id) addSkillRanks(alloc.id, alloc.subcategory, alloc.ranks);
            }
          }
          for (const gi of (tp.categoryMultiSkillRankChoices ?? []).keys()) {
            for (const alloc of res.categoryMultiSkillChoices[gi] ?? []) {
              if (alloc.id) addSkillRanks(alloc.id, alloc.subcategory, alloc.ranks);
            }
          }
          for (const gi of (tp.groupMultiSkillRankChoices ?? []).keys()) {
            for (const alloc of res.groupMultiSkillChoices[gi] ?? []) {
              if (alloc.id) addSkillRanks(alloc.id, alloc.subcategory, alloc.ranks);
            }
          }
          for (let gi = 0; gi < (tp.groupCategoryAndSkillRankChoices ?? []).length; gi++) {
            const choiceDef = (tp.groupCategoryAndSkillRankChoices ?? [])[gi];
            const slot = res.groupCategoryAndSkillChoices[gi];
            if (choiceDef && slot?.skillId) addSkillRanks(slot.skillId, slot.subcategory || undefined, choiceDef.value);
          }
        }
      }
      // Add DP-purchased skill ranks
      for (const p of skillPurchases) {
        if (p.purchases <= 0) continue;
        const devType = skillDevTypeMap.get(p.id);
        const ranksPerPurchase = getSkillRanksPerPurchase(devType);
        const totalRanks = devType === 'Restricted' ? p.purchases : p.purchases * ranksPerPurchase;
        addSkillRanks(p.id, p.subcategory || undefined, totalRanks);
      }

      /* Aggregate category ranks */
      const totalCategoryRanks = new Map<string, number>();
      const addCategoryRanks = (id: string, ranks: number) => {
        if (!id || ranks <= 0) return;
        totalCategoryRanks.set(id, (totalCategoryRanks.get(id) ?? 0) + ranks);
      };
      for (const [id, ranks] of preLevellingCategoryRanks) addCategoryRanks(id, ranks);
      for (const tp of selectedTrainingPackages) {
        for (const rank of tp.categoryRanks ?? []) addCategoryRanks(rank.id, rank.value);
        const res = tpResolutions.find((r) => r.tpId === tp.id);
        if (res) {
          for (let gi = 0; gi < (tp.groupCategoryAndSkillRankChoices ?? []).length; gi++) {
            const choiceDef = (tp.groupCategoryAndSkillRankChoices ?? [])[gi];
            const slot = res.groupCategoryAndSkillChoices[gi];
            if (choiceDef && slot?.categoryId) addCategoryRanks(slot.categoryId, choiceDef.value);
          }
        }
      }
      for (const p of categoryPurchases) {
        if (p.purchases > 0) addCategoryRanks(p.id, p.purchases);
      }

      /* Aggregate spell list ranks */
      const knownSpellListIds = new Set(spellLists.map((sl) => sl.id));
      const spellListTotals = new Map<string, number>();
      const addSpellListRanks = (slId: string, ranks: number) => {
        if (!slId || ranks <= 0 || !knownSpellListIds.has(slId)) return;
        spellListTotals.set(slId, (spellListTotals.get(slId) ?? 0) + ranks);
      };
      for (const [id, ranks] of preLevellingSpellListRanks) addSpellListRanks(id, ranks);
      for (const p of spellListPurchases) {
        if (p.purchases > 0) addSpellListRanks(p.id, p.purchases);
      }
      for (const tp of selectedTrainingPackages) {
        const res = tpResolutions.find((r) => r.tpId === tp.id);
        for (const row of (tp.spellListRanks ?? []).filter((r) => r.numChoices <= 0)) {
          for (const slId of row.options ?? []) addSpellListRanks(slId, row.value);
        }
        if (res) {
          const choiceableSlRanks = (tp.spellListRanks ?? []).filter((r) => r.numChoices > 0);
          for (let gi = 0; gi < choiceableSlRanks.length; gi++) {
            for (const alloc of res.spellListChoices[gi] ?? []) {
              addSpellListRanks(alloc.id, alloc.ranks);
            }
          }
          for (let gi = 0; gi < (tp.spellListCategoryRankChoices ?? []).length; gi++) {
            for (const alloc of res.spellListCategoryChoices[gi] ?? []) {
              addSpellListRanks(alloc.id, alloc.ranks);
            }
          }
        }
      }

      /* Aggregate language abilities */
      const totalLanguages = new Map<string, { language: string; spoken: number; written: number; somatic: number }>();
      const ensureLang = (languageId: string) => {
        let row = totalLanguages.get(languageId);
        if (!row) {
          row = { language: languageId, spoken: 0, written: 0, somatic: 0 };
          totalLanguages.set(languageId, row);
        }
        return row;
      };
      for (const row of character.languages) {
        if (!row.id) continue;
        const target = ensureLang(row.id);
        target.spoken += Math.max(0, row.spokenRanks);
        target.written += Math.max(0, row.writtenRanks);
        target.somatic += Math.max(0, row.somaticRanks);
      }
      for (const res of tpResolutions) {
        for (const group of res.languageChoices ?? []) {
          for (const alloc of group ?? []) {
            if (!alloc.languageId) continue;
            const target = ensureLang(alloc.languageId);
            target.spoken += Math.max(0, alloc.spoken ?? 0);
            target.written += Math.max(0, alloc.written ?? 0);
            target.somatic += Math.max(0, alloc.somatic ?? 0);
          }
        }
      }
      for (const lp of languagePurchases) {
        const target = ensureLang(lp.languageId);
        target.spoken += lp.spoken - lp.spokenBase;
        target.written += lp.written - lp.writtenBase;
        target.somatic += lp.somatic - lp.somaticBase;
      }

      const payload: CharacterLeveller = {
        id: leveller?.id ?? '',
        character: character.id,
        trainingPackageCosts: leveller?.trainingPackageCosts ?? [],
        trainingPackages: selectedTpIds,
        statGains: totalStatGains,
        developmentPoints: dpRemaining,
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
        languageRanks: Array.from(totalLanguages.values())
          .filter((row) => row.spoken > 0 || row.written > 0 || row.somatic > 0)
          .map((row) => ({
            language: row.language,
            ...(row.spoken > 0 ? { spoken: row.spoken } : {}),
            ...(row.written > 0 ? { written: row.written } : {}),
            ...(row.somatic > 0 ? { somatic: row.somatic } : {}),
          }))
          .sort((a, b) => a.language.localeCompare(b.language)),
      };

      const updated = await levelUpCharacter(payload);
      toast({ variant: 'success', title: 'Level-up applied', description: `${character.name} has levelled up.` });
      onFinish(updated);
    } catch (e) {
      toast({
        variant: 'danger',
        title: 'Level-up failed',
        description: String(e instanceof Error ? e.message : e),
      });
    } finally {
      setApplying(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  if (loading) return <Spinner size={24} />;
  if (error) return <div style={{ color: 'crimson' }}>Error loading level-up data: {error}</div>;

  return (
    <div className="form-panel" style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Level Up: {character.name} (Level {character.level} → {character.level + 1})</h3>
        <div style={{ fontWeight: 600 }}>DP: {dpRemaining} / {character.developmentPoints}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}>
        <input
          type="checkbox"
          id="lv-show-descriptions"
          checked={showDescriptions}
          onChange={(e) => setShowDescriptions(e.target.checked)}
        />
        <label htmlFor="lv-show-descriptions">Show descriptions</label>
      </div>

      <div style={{ color: 'var(--muted)', fontSize: '0.9em' }}>
        {substep === 'selecting' && 'Select training packages. TPs with required choices must be resolved before spending extra development points.'}
        {substep === 'resolving' && `Resolve training package choices (${resolvingTpIndex + 1} of ${tpsRequiringResolution.length}).`}
        {substep === 'purchasing' && 'Spend remaining development points on stat gains, skill ranks, category ranks, and spell list ranks.'}
      </div>

      {/* SELECTING sub-step */}
      {substep === 'selecting' && (
        <>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <h4 style={{ margin: '0 0 8px' }}>Training Packages</h4>
            {selectedTrainingPackages.length > 0 && (
              <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                {selectedTrainingPackages.map((tp) => {
                  const cost = tpCostMap.get(tp.id) ?? 0;
                  return (
                    <div key={tp.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ flex: 1 }}>
                        {tp.name}{tp.lifestyle ? ' (Lifestyle)' : ''} — {cost} DP
                        {tpHasChoices(tp) && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>(choices required)</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedTpIds((prev) => prev.filter((id) => id !== tp.id))}
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
              onChange={(v) => { if (v) setSelectedTpIds((prev) => [...prev, v]); }}
              options={tpOptions}
              placeholderOption="— Add training package —"
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {onCancel && (
              <button type="button" onClick={onCancel} disabled={applying}>Cancel</button>
            )}
            <button
              type="button"
              onClick={() => {
                if (tpsRequiringResolution.length === 0) {
                  setSubstep('purchasing');
                } else {
                  setResolvingTpIndex(0);
                  setSubstep('resolving');
                }
              }}
            >
              {tpsRequiringResolution.length === 0 ? 'Proceed to Extra Purchases →' : 'Proceed to Resolve TP Choices →'}
            </button>
          </div>
        </>
      )}

      {/* RESOLVING sub-step */}
      {substep === 'resolving' && (() => {
        const currentTp = tpsRequiringResolution[resolvingTpIndex];
        const currentResolution = currentTp ? tpResolutions.find((r) => r.tpId === currentTp.id) : undefined;
        if (!currentTp || !currentResolution) return null;
        const tpRealmStatGains = new Set<Stat>(
          currentTp.realmStatGain
            ? character.magicalRealms.flatMap((realm) => {
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
              <span style={{ color: 'var(--muted)' }}>TP {resolvingTpIndex + 1} of {tpsRequiringResolution.length}</span>
            </div>

            {currentTp.realmStatGain && character.magicalRealms.length > 0 && (
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
                                  <RichSelect label={`Skill ${ai + 1}`} value={alloc.id}
                                    onChange={(v) => updateResolution((r) => ({ ...r, skillRankChoices: r.skillRankChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, id: v, subcategory: '' })) }))}
                                    options={availableOpts} placeholderOption="— Select skill —" />
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
                                  <RichSelect label={`Skill ${ai + 1}`} value={alloc.id}
                                    onChange={(v) => updateResolution((r) => ({ ...r, categoryMultiSkillChoices: r.categoryMultiSkillChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, id: v, subcategory: '' })) }))}
                                    options={availableOpts} placeholderOption="— Select skill —" />
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
                                  <RichSelect label={`Skill ${ai + 1}`} value={alloc.id}
                                    onChange={(v) => updateResolution((r) => ({ ...r, groupMultiSkillChoices: r.groupMultiSkillChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, id: v, subcategory: '' })) }))}
                                    options={availableOpts} placeholderOption="— Select skill —" />
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
                        <LabeledSelect label="Category" value={slot.categoryId}
                          onChange={(v) => updateResolution((r) => ({
                            ...r,
                            groupCategoryAndSkillChoices: r.groupCategoryAndSkillChoices.map((s, i) => i !== gi ? s : { categoryId: v, skillId: '', subcategory: '' }),
                          }))}
                          options={catsInGroup} placeholderOption="— Select category —" />
                        {slot.categoryId && (
                          <RichSelect label="Skill" value={slot.skillId}
                            onChange={(v) => updateResolution((r) => ({
                              ...r,
                              groupCategoryAndSkillChoices: r.groupCategoryAndSkillChoices.map((s, i) => i !== gi ? s : { ...s, skillId: v, subcategory: '' }),
                            }))}
                            options={skillsInSelectedCat} placeholderOption="— Select skill —" />
                        )}
                        {slot.skillId && isWeaponsGroup && weaponTypeOpts.length > 0 && (
                          <LabeledSelect label="Weapon Type" value={slot.subcategory}
                            onChange={(v) => updateResolution((r) => ({
                              ...r,
                              groupCategoryAndSkillChoices: r.groupCategoryAndSkillChoices.map((s, i) => i !== gi ? s : { ...s, subcategory: v }),
                            }))}
                            options={weaponTypeOpts} placeholderOption="— Select weapon type —" />
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
                    const availableSlOpts = (choiceDef.options as string[]).filter((slId) => slId).map(toSpellListRichOption);
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
                                  <RichSelect label={`Spell List ${ai + 1}`} value={alloc.id}
                                    onChange={(v) => updateResolution((r) => ({ ...r, spellListChoices: r.spellListChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, id: v })) }))}
                                    options={filteredOpts} placeholderOption="— Select spell list —" />
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
                    const aggregatedSlOpts = (choiceDef.options as string[]).flatMap((catId) =>
                      (character.spellListCategories.find((c) => c.category === catId)?.spellLists ?? [])
                        .map(toSpellListRichOption),
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
                                  <RichSelect label={`Spell List ${ai + 1}`} value={alloc.id}
                                    onChange={(v) => updateResolution((r) => ({ ...r, spellListCategoryChoices: r.spellListCategoryChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { ...a, id: v })) }))}
                                    options={filteredOpts} placeholderOption="— Select spell list —" />
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
                    const poolSkills = (choiceDef.options as string[]).flatMap((catId) => skillIdsByCategory.get(catId) ?? []);
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
                              <RichSelect key={si} label={`Skill ${si + 1}`} value={val}
                                onChange={(v) => updateResolution((r) => ({
                                  ...r,
                                  lifestyleCategorySkillChoices: r.lifestyleCategorySkillChoices.map((g, gIdx) =>
                                    gIdx !== gi ? g : g.map((s, sIdx) => sIdx !== si ? s : v),
                                  ),
                                }))}
                                options={opts} placeholderOption="— Select skill —" />
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
                    const availableLangOpts = (choiceDef.options as string[])
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
                                    <LabeledSelect label={`Language ${ai + 1}`} value={alloc.languageId}
                                      onChange={(v) => updateResolution((r) => ({
                                        ...r,
                                        languageChoices: r.languageChoices.map((g, gIdx) => gIdx !== gi ? g : g.map((a, aIdx) => aIdx !== ai ? a : { languageId: v, spoken: 0, written: 0, somatic: 0 })),
                                      }))}
                                      options={filteredOpts} placeholderOption="— Select language —" />
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
                  if (resolvingTpIndex === 0) setSubstep('selecting');
                  else setResolvingTpIndex(resolvingTpIndex - 1);
                }}
              >
                ← {resolvingTpIndex === 0 ? 'TP Selection' : 'Previous TP'}
              </button>
              <button
                type="button"
                disabled={!!resError}
                onClick={() => {
                  if (resolvingTpIndex + 1 >= tpsRequiringResolution.length) {
                    setSubstep('purchasing');
                  } else {
                    setResolvingTpIndex(resolvingTpIndex + 1);
                  }
                }}
              >
                {resolvingTpIndex + 1 >= tpsRequiringResolution.length ? 'Finish Resolving →' : 'Next TP →'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* PURCHASING sub-step */}
      {substep === 'purchasing' && (
        <>
          {selectedTrainingPackages.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
              <h4 style={{ margin: '0 0 4px' }}>Selected Training Packages</h4>
              {selectedTrainingPackages.map((tp) => (
                <div key={tp.id} style={{ color: 'var(--muted)' }}>
                  {tp.name}{tp.lifestyle ? ' (Lifestyle)' : ''} — {tpCostMap.get(tp.id) ?? 0} DP
                </div>
              ))}
            </div>
          )}

          {/* Stat Gain Rolls */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <h4 style={{ margin: '0 0 8px' }}>Stat Gain Rolls ({STAT_GAIN_DP_COST} DP each)</h4>
            {statGains.length > 0 && (
              <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                {statGains.map((stat, i) => {
                  const availableOptions = STATS
                    .filter((s) => !statGainsUnavailable.has(s) && (s === stat || !statGains.includes(s)))
                    .map((s) => ({ value: s, label: s }));
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <LabeledSelect
                        label={`Stat Gain #${i + 1}`}
                        value={stat}
                        onChange={(v) => setStatGains((prev) => prev.map((s, idx) => idx === i ? v as Stat : s))}
                        options={availableOptions}
                      />
                      <button type="button" onClick={() => setStatGains((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                const nextStat = STATS.find((s) => !statGainsUnavailable.has(s) && !statGains.includes(s));
                if (nextStat) setStatGains((prev) => [...prev, nextStat]);
              }}
              disabled={
                dpRemaining < STAT_GAIN_DP_COST
                || STATS.every((s) => statGainsUnavailable.has(s) || statGains.includes(s))
              }
            >
              Add Stat Gain Roll
            </button>
          </div>

          {/* Skill Rank Purchases */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <h4 style={{ margin: '0 0 8px' }}>Skill Ranks</h4>
            {languagePurchases.length > 0 && (
              <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
                {languagePurchases.map((lp, i) => {
                  const lang = languageById.get(lp.languageId);
                  const langName = languageNameById.get(lp.languageId) ?? lp.languageId;
                  const max = communicationCategoryRanks;
                  const newRanks = (lp.spoken - lp.spokenBase) + (lp.written - lp.writtenBase) + (lp.somatic - lp.somaticBase);
                  const totalCost = Math.max(0, newRanks) * languageDpCostPerRank;
                  const controls: Array<{ key: 'spoken' | 'written' | 'somatic'; label: string; base: number; value: number; disabled: boolean }> = [
                    { key: 'spoken', label: 'Spoken', base: lp.spokenBase, value: lp.spoken, disabled: !(lang?.isSpoken ?? true) },
                    { key: 'written', label: 'Written', base: lp.writtenBase, value: lp.written, disabled: !(lang?.isWritten ?? true) },
                    { key: 'somatic', label: 'Somatic', base: lp.somaticBase, value: lp.somatic, disabled: !(lang?.isSomatic ?? true) },
                  ];
                  return (
                    <div key={lp.languageId} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <strong>{langName}</strong>
                          <span style={{ color: 'var(--muted)', marginLeft: 6 }}>{totalCost} DP ({languageDpCostPerRank} DP / rank)</span>
                          {controls.map((ctrl) => (
                            <div key={ctrl.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'nowrap' }}>
                              <span style={{ minWidth: 60, whiteSpace: 'nowrap' }}>{ctrl.label}</span>
                              {ctrl.disabled ? (
                                <span style={{ color: 'var(--muted)', minWidth: 20, textAlign: 'center' }}>&mdash;</span>
                              ) : (
                                <>
                                  <small style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>Base: {ctrl.base}, Max: {max}</small>
                                  <button type="button"
                                    disabled={ctrl.value <= ctrl.base}
                                    onClick={() => setLanguagePurchases((prev) => prev.map((p, idx) => idx !== i ? p : { ...p, [ctrl.key]: ctrl.value - 1 }))
                                    }>-</button>
                                  <span style={{ minWidth: 20, textAlign: 'center' }}>{ctrl.value}</span>
                                  <button type="button"
                                    disabled={ctrl.value >= max || dpRemaining <= 0}
                                    onClick={() => setLanguagePurchases((prev) => prev.map((p, idx) => idx !== i ? p : { ...p, [ctrl.key]: ctrl.value + 1 }))
                                    }>+</button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={() => setLanguagePurchases((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {skillPurchases.length > 0 && (
              <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
                {skillPurchases.map((purchase, i) => {
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
                  const existingSkillRanks = preLevellingSkillRanks.get(skillChoiceKey(purchase.id, purchase.subcategory || undefined)) ?? 0;
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
                              <LabeledSelect label="Weapon type" hideLabel={true}
                                value={purchase.subcategory}
                                onChange={(v) => setSkillPurchases((prev) => prev.map((p, idx) => idx === i ? { ...p, subcategory: v } : p))}
                                options={weaponTypeOptionsBySkillId.get(purchase.id) ?? []}
                                placeholderOption="— Select weapon type —" />
                            ) : (
                              <LabeledInput label="Subcategory" hideLabel={true}
                                value={purchase.subcategory}
                                onChange={(v) => setSkillPurchases((prev) => prev.map((p, idx) => idx === i ? { ...p, subcategory: v } : p))}
                                placeholder="Subcategory" />
                            )
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button type="button" disabled={purchase.purchases <= 0}
                            onClick={() => setSkillPurchases((prev) => prev.map((p, idx) => idx === i ? { ...p, purchases: p.purchases - 1 } : p))}>-</button>
                          <span style={{ minWidth: 20, textAlign: 'center' }}>{purchase.purchases}</span>
                          <button type="button" disabled={purchase.purchases >= maxPurch || nextPurchaseCost > dpRemaining}
                            onClick={() => setSkillPurchases((prev) => prev.map((p, idx) => idx === i ? { ...p, purchases: p.purchases + 1 } : p))}>+</button>
                        </div>
                        <button type="button" onClick={() => setSkillPurchases((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <RichSelect label="Skill Category" hideLabel={true}
                  value={skillCategoryFilter}
                  onChange={(v) => { setSkillCategoryFilter(v); setSkillPendingId(''); setSkillPendingSubcategory(''); }}
                  options={skillCategoryOptions}
                  placeholderOption="— Filter by category —" />
                <RichSelect label="Add Skill" hideLabel={true}
                  value=""
                  onChange={(v) => {
                    if (!v) return;
                    if (languageSkillIds.has(v)) {
                      setSkillPendingId(v);
                      setSkillPendingSubcategory('');
                    } else if (mandatorySubcategorySkillIds.has(v)) {
                      setSkillPendingId(v);
                      setSkillPendingSubcategory('');
                    } else {
                      setSkillPurchases((prev) => [...prev, { id: v, subcategory: '', purchases: 1 }]);
                      setSkillPendingId('');
                      setSkillPendingSubcategory('');
                    }
                  }}
                  options={skillOptions}
                  placeholderOption={skillCategoryFilter ? '— Select skill —' : '— Select a category first —'} />
              </div>
              {skillPendingId && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 500 }}>{skillNameById.get(skillPendingId) ?? skillPendingId}:</span>
                  {languageSkillIds.has(skillPendingId) ? (
                    <LabeledSelect label="Language" hideLabel={true}
                      value=""
                      onChange={(v) => {
                        if (!v) return;
                        const existing = currentLanguageRanksById.get(v);
                        setLanguagePurchases((prev) => [
                          ...prev.filter((lp) => lp.languageId !== v),
                          {
                            languageId: v,
                            spokenBase: existing?.spoken ?? 0,
                            writtenBase: existing?.written ?? 0,
                            somaticBase: existing?.somatic ?? 0,
                            spoken: existing?.spoken ?? 0,
                            written: existing?.written ?? 0,
                            somatic: existing?.somatic ?? 0,
                          },
                        ]);
                        setSkillPendingId('');
                        setSkillPendingSubcategory('');
                      }}
                      options={languageSelectOptions.filter((opt) => !languagePurchases.some((lp) => lp.languageId === opt.value))}
                      placeholderOption="— Select language —" />
                  ) : weaponGroupSkillIds.has(skillPendingId) ? (
                    <LabeledSelect label="Weapon type" hideLabel={true}
                      value={skillPendingSubcategory}
                      onChange={(v) => setSkillPendingSubcategory(v)}
                      options={weaponTypeOptionsBySkillId.get(skillPendingId) ?? []}
                      placeholderOption="— Select weapon type —" />
                  ) : (
                    <LabeledInput label="Subcategory" hideLabel={true}
                      value={skillPendingSubcategory}
                      onChange={(v) => setSkillPendingSubcategory(v)}
                      placeholder="Subcategory" />
                  )}
                  {!languageSkillIds.has(skillPendingId) && (
                    <button type="button" disabled={!skillPendingSubcategory.trim()}
                      onClick={() => {
                        setSkillPurchases((prev) => [...prev, { id: skillPendingId, subcategory: skillPendingSubcategory.trim(), purchases: 1 }]);
                        setSkillPendingId('');
                        setSkillPendingSubcategory('');
                      }}>Add</button>
                  )}
                  <button type="button" onClick={() => { setSkillPendingId(''); setSkillPendingSubcategory(''); }}>Cancel</button>
                </div>
              )}
            </div>
          </div>

          {/* Category Rank Purchases */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <h4 style={{ margin: '0 0 8px' }}>Skill Category Ranks</h4>
            {categoryPurchases.length > 0 && (
              <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                {categoryPurchases.map((purchase, i) => {
                  const catName = categoryNameById.get(purchase.id) ?? purchase.id;
                  const costElements = categoryCostMap.get(purchase.id) ?? [];
                  const tpRanksForCat = tpGrantedCategoryRankCounts.get(purchase.id) ?? 0;
                  const maxPurch = getCategoryMaxDpPurchases(costElements, tpRanksForCat);
                  const totalCost = getCategoryDpCostWithTpOffset(costElements, purchase.purchases, tpRanksForCat);
                  const nextCost = purchase.purchases < maxPurch
                    ? getCategoryDpCostWithTpOffset(costElements, purchase.purchases + 1, tpRanksForCat) - totalCost
                    : 0;
                  const existingCatRanks = preLevellingCategoryRanks.get(purchase.id) ?? 0;
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
                        <button type="button" disabled={purchase.purchases <= 0}
                          onClick={() => setCategoryPurchases((prev) => prev.map((p, idx) => idx === i ? { ...p, purchases: p.purchases - 1 } : p))}>-</button>
                        <span style={{ minWidth: 20, textAlign: 'center' }}>{purchase.purchases}</span>
                        <button type="button" disabled={purchase.purchases >= maxPurch || nextCost > dpRemaining}
                          onClick={() => setCategoryPurchases((prev) => prev.map((p, idx) => idx === i ? { ...p, purchases: p.purchases + 1 } : p))}>+</button>
                      </div>
                      <button type="button" onClick={() => setCategoryPurchases((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>
                    </div>
                  );
                })}
              </div>
            )}
            <RichSelect label="Add Category" value="" hideLabel={true}
              onChange={(v) => { if (v) setCategoryPurchases((prev) => [...prev, { id: v, purchases: 1 }]); }}
              options={categoryOptions}
              placeholderOption="— Add category —" />
          </div>

          {/* Spell List Rank Purchases */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
            <h4 style={{ margin: '0 0 8px' }}>Spell List Ranks</h4>
            {spellListPurchases.length > 0 && (
              <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                {spellListPurchases.map((purchase, i) => {
                  const slName = spellListNameById.get(purchase.id) ?? purchase.id;
                  const catEntry = character.spellListCategories.find((c) => c.spellLists.includes(purchase.id));
                  const costElements = catEntry ? (categoryCostMap.get(catEntry.category) ?? []) : [];
                  const tpRanksForSl = tpGrantedSpellListRankCounts.get(purchase.id) ?? 0;
                  const maxPurch = getCategoryMaxDpPurchases(costElements, tpRanksForSl);
                  const totalCost = getCategoryDpCostWithTpOffset(costElements, purchase.purchases, tpRanksForSl);
                  const nextCost = purchase.purchases < maxPurch
                    ? getCategoryDpCostWithTpOffset(costElements, purchase.purchases + 1, tpRanksForSl) - totalCost
                    : 0;
                  const existingSlRanks = preLevellingSpellListRanks.get(purchase.id) ?? 0;
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
                        <button type="button" disabled={purchase.purchases <= 0}
                          onClick={() => setSpellListPurchases((prev) => prev.map((p, idx) => idx === i ? { ...p, purchases: p.purchases - 1 } : p))}>-</button>
                        <span style={{ minWidth: 20, textAlign: 'center' }}>{purchase.purchases}</span>
                        <button type="button" disabled={purchase.purchases >= maxPurch || nextCost > dpRemaining}
                          onClick={() => setSpellListPurchases((prev) => prev.map((p, idx) => idx === i ? { ...p, purchases: p.purchases + 1 } : p))}>+</button>
                      </div>
                      <button type="button" onClick={() => setSpellListPurchases((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>
                    </div>
                  );
                })}
              </div>
            )}
            {addingSpellList ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <RichSelect label="Spell Category" hideLabel={true}
                  value={selectedSpellCategory}
                  onChange={(v) => setSelectedSpellCategory(v)}
                  options={spellCategoryOptions}
                  placeholderOption="— Select category —" />
                {selectedSpellCategory && spellListsInSelectedCategory.length > 0 && (
                  <RichSelect label="Spell List" hideLabel={true}
                    value=""
                    onChange={(v) => {
                      if (v) {
                        setSpellListPurchases((prev) => [...prev, { id: v, purchases: 1 }]);
                        setSelectedSpellCategory('');
                        setAddingSpellList(false);
                      }
                    }}
                    options={spellListsInSelectedCategory.map((sl) => toSpellListRichOption(sl.id))}
                    placeholderOption="— Select spell list —" />
                )}
                {selectedSpellCategory && spellListsInSelectedCategory.length === 0 && (
                  <div style={{ color: 'var(--muted)' }}>No more spell lists available in this category.</div>
                )}
                <div>
                  <button type="button" onClick={() => { setAddingSpellList(false); setSelectedSpellCategory(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={
                  dpRemaining <= 0
                  || character.spellListCategories.every((c) =>
                    c.spellLists.every((slId) => spellListPurchases.some((p) => p.id === slId)),
                  )
                }
                onClick={() => setAddingSpellList(true)}
              >
                Add Spell List
              </button>
            )}
          </div>

          {validationError && <div style={{ color: '#b00020' }}>{validationError}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                if (tpsRequiringResolution.length === 0) setSubstep('selecting');
                else { setResolvingTpIndex(tpsRequiringResolution.length - 1); setSubstep('resolving'); }
              }}
            >
              ← Back
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel} disabled={applying}>Cancel</button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={applying || Boolean(validate())}
            >
              {applying ? 'Applying…' : 'Complete Level Up'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
