import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import {
  applyLevelUpgrade,
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
  setCharacterBuilderStats,
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

import { DEVELOPMENT_STATS, SPELL_REALMS, STATS, type Realm, type Stat } from '../../types/enum';
import { isValidUnsignedInt, sanitizeUnsignedInt } from '../../utils';

type CharacterStep =
  | 'primary'
  | 'initial'
  | 'stats'
  | 'hobby'
  | 'background'
  | 'apprenticeship'
  | 'apply';

const STEP_ORDER: CharacterStep[] = [
  'primary',
  'initial',
  'stats',
  'hobby',
  'background',
  'apprenticeship',
  'apply',
];

const STEP_LABELS: Record<CharacterStep, string> = {
  primary: '1. Primary Definition',
  initial: '2. Initial Choices',
  stats: '3. Stat Generation',
  hobby: '4. Hobby Ranks',
  background: '5. Background Options',
  apprenticeship: '6. Apprenticeship Skills',
  apply: '7. Apply Level Upgrade',
};

type StepErrors = {
  primary?: string | undefined;
  initial?: string | undefined;
  stats?: string | undefined;
  hobby?: string | undefined;
  background?: string | undefined;
  apprenticeship?: string | undefined;
  apply?: string | undefined;
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

type BackgroundOptionState = {
  extraStatGainRolls: boolean;
  extraMoneyPoints: number;
  extraLanguages: boolean;
  languageRows: BackgroundLanguageRow[];
  skillBonusIds: string[];
  categoryBonusIds: string[];
  specialItemsPoints: number;
};

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

function parseSkillChoiceKey(key: string): { id: string; subcategory?: string | undefined } {
  const idx = key.indexOf('::');
  if (idx < 0) return { id: key };
  const id = key.slice(0, idx);
  const subcategory = key.slice(idx + 2).trim();
  return {
    id,
    subcategory: subcategory || undefined,
  };
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
    skillBonusIds: [],
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
    + state.skillBonusIds.length
    + state.categoryBonusIds.length
    + state.specialItemsPoints;
}

function getSelectedBackgroundOptionsPayload(state: BackgroundOptionState): string[] {
  const out: string[] = [];
  if (state.extraStatGainRolls) out.push('EXTRA_STAT_GAIN_ROLLS');
  for (let i = 0; i < state.extraMoneyPoints; i++) out.push('EXTRA_MONEY');
  if (state.extraLanguages) out.push('EXTRA_LANGUAGES');
  for (const id of state.skillBonusIds) out.push(`SKILL_BONUS:${id}`);
  for (const id of state.categoryBonusIds) out.push(`SKILL_CATEGORY_BONUS:${id}`);
  for (let i = 0; i < state.specialItemsPoints; i++) out.push('SPECIAL_ITEMS');
  return out;
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
  const [backgroundSkillBonusIds, setBackgroundSkillBonusIds] = useState<string[]>([]);
  const [backgroundCategoryBonusIds, setBackgroundCategoryBonusIds] = useState<string[]>([]);
  const [backgroundSpecialItemsPoints, setBackgroundSpecialItemsPoints] = useState(0);

  const [trainingPackageId, setTrainingPackageId] = useState('');
  const [tpStatGainChoices, setTpStatGainChoices] = useState<Stat[]>([]);
  const [tpSkillRankChoiceSelections, setTpSkillRankChoiceSelections] = useState<string[][]>([]);
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

  const raceEverymanSkillOptions = useMemo(() => {
    return raceEverymanChoiceDefinitions.map((choice) => {
      const categorySet = new Set(choice.options);
      const rows = skills
        .filter((s) => categorySet.has(s.category))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      return rows.map((s) => ({ value: s.id, label: s.name }));
    });
  }, [raceEverymanChoiceDefinitions, skills]);

  const cultureTypeCategorySkillOptions = useMemo(() => {
    return cultureTypeCategorySkillRankDefinitions.map((choice) => {
      const rows = skillIdsByCategory.get(choice.id) ?? [];
      return rows.map((s) => ({ value: s.id, label: s.name }));
    });
  }, [cultureTypeCategorySkillRankDefinitions, skillIdsByCategory]);

  const professionSkillDevelopmentOptions = useMemo(() => {
    return professionSkillDevelopmentChoiceDefinitions.map((choice) => {
      const ids = new Set(choice.options.map((option) => option.id));
      return skills
        .filter((s) => ids.has(s.id))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ value: s.id, label: s.name }));
    });
  }, [professionSkillDevelopmentChoiceDefinitions, skills]);

  const professionCategoryDevelopmentOptions = useMemo(() => {
    return professionCategoryDevelopmentChoiceDefinitions.map((choice) => {
      const categorySet = new Set(choice.options);
      return skills
        .filter((s) => categorySet.has(s.category))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ value: s.id, label: s.name }));
    });
  }, [professionCategoryDevelopmentChoiceDefinitions, skills]);

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
        .map((s) => ({ value: s.id, label: s.name }));
    });
  }, [professionGroupDevelopmentChoiceDefinitions, categoryIdsByGroup, skills]);

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

  const languageNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of languages) map.set(l.id, l.name);
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
    skillBonusIds: backgroundSkillBonusIds,
    categoryBonusIds: backgroundCategoryBonusIds,
    specialItemsPoints: backgroundSpecialItemsPoints,
  }), [
    backgroundExtraStatGainRolls,
    backgroundExtraMoneyPoints,
    backgroundExtraLanguages,
    backgroundLanguageRows,
    backgroundSkillBonusIds,
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
    () =>
      skills
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ value: s.id, label: s.name })),
    [skills],
  );

  const selectedBackgroundSkillSet = useMemo(() => new Set(backgroundSkillBonusIds), [backgroundSkillBonusIds]);
  const availableBackgroundSkillBonusOptions = useMemo(
    () => backgroundSkillBonusOptions.filter((opt) => !selectedBackgroundSkillSet.has(opt.value)),
    [backgroundSkillBonusOptions, selectedBackgroundSkillSet],
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

  const selectedTrainingPackage = useMemo(
    () => availableTrainingPackages.find((tp) => tp.id === trainingPackageId),
    [availableTrainingPackages, trainingPackageId],
  );

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
    setTpSkillRankChoiceSelections((prev) => {
      const len = selectedTrainingPackage?.skillRankChoices.length ?? 0;
      const next = Array.from({ length: len }, (_, i) => prev[i] ?? []);
      return next;
    });
  }, [selectedTrainingPackage]);

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
    setProfessionBaseSpellListChoiceRows((prev) => professionBaseSpellListChoiceDefinitions.map((choice, i) => {
      const existing = prev[i] ?? [];
      return Array.from({ length: choice.numChoices }, (_, slot) => existing[slot] ?? '');
    }));
  }, [professionBaseSpellListChoiceDefinitions]);

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
    setBackgroundSkillBonusIds(reset.skillBonusIds);
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
          bonus: (race?.statBonuses.find((b) => b.id === roll.assignedStat)?.value ?? 0)
            + tpStatGainChoices.filter((s) => s === roll.assignedStat).length,
        })),
    }));
  }, [characterName, raceId, cultureTypeId, cultureId, professionId, selectedRealms, statRolls, race, tpStatGainChoices]);

  useEffect(() => {
    setCharacterBuilder((prev) => ({
      ...prev,
      hobby_skill_ranks: hobbySkillRows.map((row) => ({
        id: row.id,
        subcategory: row.subcategory,
        value: row.value,
      })),
      hobby_category_ranks: hobbyCategoryRows.map((row) => ({
        id: row.id,
        value: row.value,
      })),
      languageAbilities: hobbyLanguageRows.map((row) => ({
        language: row.language,
        spoken: row.spoken,
        written: row.written,
        somatic: row.somatic,
      })),
      spell_list_ranks: spellListRanksBudget > 0 && hobbySpellListId
        ? [{ id: hobbySpellListId, value: spellListRanksBudget }]
        : [],
      numHobbySkillRanks: hobbySkillRows.reduce((sum, row) => sum + row.value, 0)
        + hobbyCategoryRows.reduce((sum, row) => sum + row.value, 0),
      num_adolescent_spell_list_ranks: spellListRanksBudget > 0 && hobbySpellListId ? spellListRanksBudget : 0,
    }));
  }, [hobbySkillRows, hobbyCategoryRows, hobbyLanguageRows, hobbySpellListId, spellListRanksBudget]);

  useEffect(() => {
    if (!profession) {
      setCharacterBuilder((prev) => ({
        ...prev,
        skillDevelopmentTypes: [],
        categorySpecialBonuses: [],
        categoryDevelopmentTypes: [],
        groupSpecialBonuses: [],
        groupDevelopmentTypes: [],
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
      categoryDevelopmentTypes: profession.skillCategorySkillDevelopmentTypes.map((item) => ({
        id: item.id,
        value: item.value,
      })),
      groupSpecialBonuses: profession.skillGroupSpecialBonuses.map((item) => ({
        id: item.id,
        value: item.value,
      })),
      groupDevelopmentTypes: profession.skillGroupSkillDevelopmentTypes.map((item) => ({
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
        spoken: row.spoken,
        written: row.written,
        somatic: row.somatic,
      }))
      : [];

    setCharacterBuilder((prev) => ({
      ...prev,
      skillProfessionalBonuses: backgroundState.skillBonusIds.map((id) => ({
        id,
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
    const trainingPackage = selectedTrainingPackage;
    if (!trainingPackage) {
      setCharacterBuilder((prev) => ({
        ...prev,
        skillRanks: [],
        categoryRanks: [],
        spellListRanks: [],
        numHobbySkillRanks: prev.hobbySkillRanks.reduce((sum, row) => sum + row.value, 0),
        numAdolescentSpellListRanks: 0,
      }));
      return;
    }

    const selectedChoiceSkillRanks = trainingPackage.skillRankChoices.flatMap((choice, i) => {
      const selected = tpSkillRankChoiceSelections[i] ?? [];
      return selected.map((key) => {
        const parsed = parseSkillChoiceKey(key);
        return {
          id: parsed.id,
          subcategory: parsed.subcategory,
          value: choice.value,
        };
      });
    });

    const skillRanks = [
      ...trainingPackage.skillRanks.map((rank) => ({
        id: rank.id,
        subcategory: rank.subcategory,
        value: rank.value,
      })),
      ...selectedChoiceSkillRanks,
    ];

    const categoryRanks = trainingPackage.categoryRanks.map((rank) => ({
      id: rank.id,
      value: rank.value,
    }));

    const spellListRanks = trainingPackage.spellListRanks
      .filter((rank) => rank.numChoices <= 0)
      .map((rank) => ({
        id: rank.optionalCategory ?? '',
        value: rank.value,
      }))
      .filter((rank) => Boolean(rank.id));

    setCharacterBuilder((prev) => ({
      ...prev,
      skillRanks: skillRanks,
      categoryRanks: categoryRanks,
      spellListRanks: spellListRanks,
      numHobbySkillRanks: prev.hobbySkillRanks.reduce((sum, row) => sum + row.value, 0),
      numAdolescentSpellListRanks: spellListRanks.reduce((sum, row) => sum + row.value, 0),
    }));
  }, [selectedTrainingPackage, tpSkillRankChoiceSelections]);

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
        if (mandatorySubcategorySkillIds.has(row.id) && !row.subcategory.trim()) {
          const skillName = skillNameById.get(row.id) ?? row.id;
          return `Racial Everyman Skills choice ${choiceIndex + 1}: enter subcategory for ${skillName}.`;
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
    if (backgroundExtraLanguages && backgroundLanguageRankSpent > backgroundLanguageRanksBudget) {
      return `Background language ranks are over-allocated by ${backgroundLanguageRankSpent - backgroundLanguageRanksBudget}.`;
    }
    if (backgroundExtraLanguages && backgroundLanguageRankRemaining > 0) {
      return `Spend all extra language ranks before continuing. Remaining: ${backgroundLanguageRankRemaining}.`;
    }
    return undefined;
  };

  const validateApprenticeship = (): string | undefined => {
    if (!trainingPackageId) return 'Training package selection is required.';
    const tp = selectedTrainingPackage;
    if (!tp) return 'Selected training package is not valid.';

    if (tp.statGainChoices) {
      const required = tp.statGainChoices.numChoices;
      if (tpStatGainChoices.length !== required) {
        return `Training package requires exactly ${required} stat gain choices.`;
      }
    }

    for (let i = 0; i < tp.skillRankChoices.length; i++) {
      const def = tp.skillRankChoices[i];
      if (!def) continue;
      const selected = tpSkillRankChoiceSelections[i] ?? [];
      if (selected.length !== def.numChoices) {
        return `Skill rank choice #${i + 1} requires exactly ${def.numChoices} selections.`;
      }
    }

    return undefined;
  };

  const recomputeErrors = () => {
    const next: StepErrors = {
      primary: validateInitial(),
      initial: validateInitialChoices(),
      stats: validateStats(),
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
    hobbyRankSpent,
    hobbyRanksBudget,
    languageRankSpent,
    languageRanksBudget,
    spellListRanksBudget,
    hobbySpellListId,
    hobbySkillRows,
    selectedBackgroundPoints,
    backgroundExtraLanguages,
    backgroundLanguageRankSpent,
    backgroundLanguageRanksBudget,
    backgroundLanguageRankRemaining,
    trainingPackageId,
    tpStatGainChoices,
    tpSkillRankChoiceSelections,
  ]);

  const canGoNext = (() => {
    if (step === 'apply') return false;
    const e = errors[step];
    return !e;
  })();

  const showPostStatsSummary = STEP_ORDER.indexOf(step) > STEP_ORDER.indexOf('stats');
  const postStatsSummaryValue = `${race?.name ?? ''} - ${profession?.name ?? ''} (${characterBuilder.id || ''})`.trim();

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
          spoken: row.spoken,
          written: row.written,
          somatic: row.somatic,
        }))
      : [];

    const backgroundSkillBonus = backgroundState.skillBonusIds.map((id) => ({
      id,
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
          name: characterName.trim(),
          race: raceId,
          culture: cultureId,
          profession: professionId,
          realms: selectedRealms,
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
        const statsPayload = STATS.map((stat) => {
          const assigned = statRolls.find((roll) => roll.assignedStat === stat);
          if (!assigned) {
            throw new Error(`Missing assigned roll for stat ${stat}.`);
          }

          return {
            stat,
            temporary: Number(assigned.temporary) || 0,
            potential: assigned.potential ?? 0,
          };
        });

        const statsSetup = await setCharacterBuilderStats({
          id: characterBuilder.id,
          stats: statsPayload,
        });

        const baseSkillByKey = new Map<string, number>();
        for (const row of characterBuilder.skillRanks ?? []) {
          const key = skillChoiceKey(row.id, row.subcategory);
          baseSkillByKey.set(key, (baseSkillByKey.get(key) ?? 0) + (row.value ?? 0));
        }

        const baseCategoryById = new Map<string, number>();
        for (const row of characterBuilder.categoryRanks ?? []) {
          baseCategoryById.set(row.id, (baseCategoryById.get(row.id) ?? 0) + (row.value ?? 0));
        }

        const baseLanguageById = new Map<string, { spoken: number; written: number; somatic: number }>();
        for (const row of characterBuilder.languageAbilities ?? []) {
          baseLanguageById.set(row.language, {
            spoken: row.spoken ?? 0,
            written: row.written ?? 0,
            somatic: row.somatic ?? 0,
          });
        }

        const hobbySkillInit = (statsSetup.hobbySkills ?? []).map((row) => {
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

        const hobbyCategoryInit = (statsSetup.hobbyCategories ?? []).map((row) => {
          const base = baseCategoryById.get(row.id) ?? 0;
          const max = base + Math.max(0, row.value ?? 0);
          return {
            id: row.id,
            base,
            max,
            value: base,
          };
        });

        const hobbyLanguageInit = (statsSetup.adolescentLanguages ?? []).map((row) => {
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

        const spellListOptions = (statsSetup.adolescentSpellLists ?? []).map((x) => String(x));
        const spellListRankBudget = Math.max(0, statsSetup.numSpellListRanks ?? 0);
        const existingSpellListId = spellListRankBudget > 0
          ? (characterBuilder.adolescentSpellListChoice ?? '')
          : '';
        const spellListSelection = spellListRankBudget > 0
          ? (spellListOptions.includes(existingSpellListId) ? existingSpellListId : '')
          : '';

        setHobbyRanksBudget(Math.max(0, statsSetup.numHobbyRanks ?? 0));
        setHobbySkillRows(hobbySkillInit);
        setHobbyCategoryRows(hobbyCategoryInit);

        setLanguageRanksBudget(Math.max(0, statsSetup.numLanguageRanks ?? 0));
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
        const hobbyRanks = hobbySkillRows
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

        const adolescentLanguages = hobbyLanguageRows
          .filter((row) => row.spoken > row.baseSpoken || row.written > row.baseWritten || row.somatic > row.baseSomatic)
          .map((row) => ({
            language: row.language,
            spoken: row.spoken,
            written: row.written,
            somatic: row.somatic,
          }));

        const response = await setCharacterHobbyChoices({
          id: characterBuilder.id,
          hobbyRanks,
          hobbyCategoryRanks,
          adolescentLanguages,
          adolescentSpellList: hobbySpellListId || '',
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

  const toggleStringSelection = (
    selected: string[],
    value: string,
    max: number,
  ): string[] => {
    const has = selected.includes(value);
    if (has) return selected.filter((x) => x !== value);
    if (selected.length >= max) return selected;
    return [...selected, value];
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
      if (selectedBackgroundSkillSet.has(id)) return;
      if (!canSpendBackgroundPoints(1)) return;
      setBackgroundSkillBonusIds((prev) => [...prev, id]);
    },

    removeSkillBonus(id: string) {
      setBackgroundSkillBonusIds((prev) => prev.filter((x) => x !== id));
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
    setBackgroundSkillBonusIds(reset.skillBonusIds);
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
    setTrainingPackageId('');
    setTpStatGainChoices([]);
    setTpSkillRankChoiceSelections([]);
    setCharacterBuilder(createEmptyCharacterBuilder());
    setErrors({});
  };

  const submitLevelUpgrade = async () => {
    if (!raceId || !cultureId || !professionId || selectedRealms.length === 0 || !selectedTrainingPackage) return;

    const nextErrors = recomputeErrors();
    if (Object.values(nextErrors).some(Boolean)) {
      toast({
        variant: 'warning',
        title: 'Cannot apply level upgrade',
        description: 'Please resolve validation issues in earlier steps.',
      });
      return;
    }

    const tempStatsAsNumbers = {} as Record<Stat, number>;
    const potentialStatsAsNumbers = {} as Record<Stat, number>;
    for (const roll of statRolls) {
      if (!roll.assignedStat) continue;
      tempStatsAsNumbers[roll.assignedStat] = Number(roll.temporary);
      potentialStatsAsNumbers[roll.assignedStat] = roll.potential ?? 0;
    }

    setApplying(true);
    try {
      const payload = {
        character: {
          name: characterName,
          raceId,
          cultureId,
          professionId,
          realms: selectedRealms,
        },
        temporaryStats: tempStatsAsNumbers,
        potentialStats: potentialStatsAsNumbers,
        selectedAdolescentSkills: {
          predefinedSkillIds: [],
          selectedRaceCategoryChoices: [],
          selectedProfessionSkillChoices: [],
        },
        selectedBackgroundOptions: selectedBackgroundOptionsPayload,
        apprenticeship: {
          trainingPackageId,
          selectedStatGainChoices: tpStatGainChoices,
          selectedSkillRankChoices: tpSkillRankChoiceSelections.map((row) => row.map(parseSkillChoiceKey)),
        },
      };

      const response = await applyLevelUpgrade(payload);

      toast({
        variant: 'success',
        title: 'Level upgrade applied',
        description: response.message ?? 'Server accepted level-up application.',
      });
    } catch (e) {
      toast({
        variant: 'danger',
        title: 'Apply level upgrade failed',
        description: String(e instanceof Error ? e.message : e),
      });
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
        {showPostStatsSummary && (
          <LabeledInput
            label="Character"
            hideLabel={true}
            value={postStatsSummaryValue}
            onChange={() => { }}
            inputProps={{ readOnly: true }}
            disabled
          />
        )}

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
          {(generatingStats || applying || savingPrimaryDefinition || savingInitialChoices || savingStats || savingHobbyChoices || savingBackgroundChoices) && (
            <div className="overlay">
              <Spinner size={24} />
              <span>
                {savingPrimaryDefinition
                  ? 'Saving primary definition…'
                  : savingInitialChoices
                    ? 'Saving initial choices…'
                    : savingStats
                      ? 'Saving stats…'
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
                  containerStyle={{ gridColumn: '1 / -1' }}
                  error={errors.primary && !characterName.trim() ? 'Required' : undefined}
                />

                <LabeledSelect
                  label="Race"
                  value={raceId}
                  onChange={(v) => {
                    setRaceId(v);
                    setTrainingPackageId('');
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
                    setTrainingPackageId('');
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
                    setTrainingPackageId('');
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
                  options={professionOptions}
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
                        {rows.map((row, rowIndex) => (
                          <div key={`race-everyman-${choiceIndex}-${rowIndex}`} style={{ display: 'grid', gap: 6, gridTemplateColumns: 'minmax(260px, 1fr) minmax(220px, 1fr)' }}>
                            <LabeledSelect
                              label={`Skill ${rowIndex + 1}`}
                              value={row.id}
                              onChange={(value) => updateGroupedSkillChoiceRow(setRaceEverymanChoiceRows, choiceIndex, rowIndex, {
                                id: value,
                                subcategory: '',
                              })}
                              options={optionList}
                              placeholderOption="— Select skill —"
                            />
                            {row.id && mandatorySubcategorySkillIds.has(row.id) ? (
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
                        ))}
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
                          <LabeledSelect
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
                                <LabeledSelect
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
                                <LabeledSelect
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
                                <LabeledSelect
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
                      .map((id) => ({ value: id, label: spellListNameById.get(id) ?? id }))
                      .sort((a, b) => a.label.localeCompare(b.label));
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
                              <LabeledSelect
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
                <button type="button" onClick={generateAllTemporary}>Generate 10 Temporary Rolls (d100)</button>
                <button type="button" onClick={getPotentials} disabled={statRollsLocked || generatingStats}>Get potentials</button>
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
                <LabeledSelect
                  label={`Hobby Spell List (${spellListRanksBudget} ranks)`}
                  value={hobbySpellListId}
                  onChange={(v) => setHobbySpellListId(v)}
                  options={hobbySpellListOptions.map((id) => ({ value: id, label: spellListNameById.get(id) ?? id }))}
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
                  <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
                    <LabeledSelect
                      label="Add Skill Bonus"
                      hideLabel={true}
                      value=""
                      onChange={backgroundActions.addSkillBonus}
                      options={availableBackgroundSkillBonusOptions}
                      placeholderOption="— Select skill —"
                      disabled={availableBackgroundSkillBonusOptions.length === 0 || !canSpendBackgroundPoints(1)}
                    />
                  </div>
                  {backgroundSkillBonusIds.length > 0 && (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {backgroundSkillBonusIds.map((id) => (
                        <div key={`bg-skill-${id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span>{skillNameById.get(id) ?? id} (+10)</span>
                          <button
                            type="button"
                            onClick={() => backgroundActions.removeSkillBonus(id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
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
              <div style={{ color: 'var(--muted)' }}>
                This step applies level 0 to level 1 and is structured for reuse in later level-ups.
              </div>

              <LabeledSelect
                label="Training Package"
                value={trainingPackageId}
                onChange={(v) => {
                  setTrainingPackageId(v);
                  setTpStatGainChoices([]);
                  setTpSkillRankChoiceSelections([]);
                }}
                options={availableTrainingPackages
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((tp) => ({ value: tp.id, label: tp.name }))}
                error={errors.apprenticeship && !trainingPackageId ? 'Required' : undefined}
              />

              {selectedTrainingPackage?.statGainChoices && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                  <h4 style={{ margin: '0 0 8px' }}>Stat Gain Choices</h4>
                  <div style={{ color: 'var(--muted)' }}>
                    Pick {selectedTrainingPackage.statGainChoices.numChoices}
                  </div>
                  <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                    {selectedTrainingPackage.statGainChoices.options.map((s) => (
                      <CheckboxInput
                        key={s}
                        label={s}
                        checked={tpStatGainChoices.includes(s)}
                        onChange={() => {
                          setTpStatGainChoices((prev) => {
                            const has = prev.includes(s);
                            if (has) return prev.filter((x) => x !== s);
                            if (prev.length >= selectedTrainingPackage.statGainChoices!.numChoices) return prev;
                            return [...prev, s];
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {selectedTrainingPackage && selectedTrainingPackage.skillRankChoices.length > 0 && (
                <div style={{ display: 'grid', gap: 10 }}>
                  <h4 style={{ margin: 0 }}>Skill Rank Choices</h4>
                  {selectedTrainingPackage.skillRankChoices.map((choice, i) => {
                    const selected = tpSkillRankChoiceSelections[i] ?? [];
                    return (
                      <div key={`tp-skill-${i}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                        <div style={{ color: 'var(--muted)', marginBottom: 6 }}>
                          Choice #{i + 1}: pick {choice.numChoices} (value {choice.value})
                        </div>
                        <div style={{ display: 'grid', gap: 6 }}>
                          {choice.options.map((opt) => {
                            const key = skillChoiceKey(opt.id, opt.subcategory);
                            const label = `${skillNameById.get(opt.id) ?? opt.id}${opt.subcategory ? ` (${opt.subcategory})` : ''}`;
                            return (
                              <CheckboxInput
                                key={key}
                                label={label}
                                checked={selected.includes(key)}
                                onChange={() => {
                                  setTpSkillRankChoiceSelections((prev) => {
                                    const copy = prev.map((row) => row.slice());
                                    const row = copy[i] ?? [];
                                    copy[i] = toggleStringSelection(row, key, choice.numChoices);
                                    return copy;
                                  });
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {errors.apprenticeship && <div style={{ color: '#b00020' }}>{errors.apprenticeship}</div>}
            </section>
          )}

          {step === 'apply' && (
            <section style={{ display: 'grid', gap: 12 }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                <h4 style={{ margin: '0 0 8px' }}>Summary</h4>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Name: {characterName || 'None'}</li>
                  <li>Race: {race?.name ?? raceId}</li>
                  <li>Culture: {culture?.name ?? cultureId}</li>
                  <li>Profession: {profession?.name ?? professionId}</li>
                  <li>Realms: {selectedRealms.join(', ') || 'None'}</li>
                  <li>Builder ID: {characterBuilder.id || 'Not generated yet'}</li>
                  <li>Prime Stats: {primeStats.join(', ') || 'None'}</li>
                  <li>Background selections: {selectedBackgroundPoints}</li>
                  <li>Training package: {selectedTrainingPackage?.name ?? trainingPackageId}</li>
                </ul>
              </div>

              {(errors.primary || errors.stats || errors.hobby || errors.background || errors.apprenticeship) && (
                <div style={{ color: '#b00020' }}>
                  There are validation issues in previous steps. Please go back and correct them before applying level upgrade.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={submitLevelUpgrade}
                  disabled={applying || Boolean(errors.primary || errors.stats || errors.hobby || errors.background || errors.apprenticeship)}
                >
                  {applying ? 'Applying…' : 'Apply Level Upgrade'}
                </button>
                <button type="button" onClick={resetWorkflow}>
                  Start Over
                </button>
              </div>
            </section>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={goPrev} disabled={step === 'primary'}>Back</button>
            <button type="button" onClick={goNext} disabled={!canGoNext || step === 'apply' || savingPrimaryDefinition || savingInitialChoices || savingStats || savingHobbyChoices || savingBackgroundChoices}>Next</button>
          </div>
        </div>
      </div>
    </>
  );
}
