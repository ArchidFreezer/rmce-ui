import { useEffect, useMemo, useRef, useState } from 'react';


import {
  fetchBooks,
  fetchTrainingPackages, upsertTrainingPackage, deleteTrainingPackage,
  fetchRaces,
  fetchSkills,
  fetchSkillCategories,
  fetchSkillGroups,
  fetchSpellLists,
  fetchLanguages,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  CheckboxGroup,
  CheckboxInput,
  ChoiceListEditor,
  IdListEditor,
  IdMultiSkillRankEditor,
  IdValueListEditor,
  LabeledInput,
  LabeledSelect,
  LanguageChoiceEditor,
  MarkupPreview,
  MarkupPreviewList,
  SkillListEditor,
  SkillRankChoiceEditor,
  SkillValueListEditor,
  SpellListCategoryRankEditor,
  SpellListRankEditor,
  Spinner,
  StatGainChoiceEditor,
  TextNumberListEditor,
  useConfirm, useToast,
} from '../../components';

import type {
  Book,
  Language,
  SkillGroup,
  Skill,
  SkillCategory,
  SpellList,
  TrainingPackage,
} from '../../types';

import {
  STATS, type Stat,
} from '../../types/enum';

import {
  isValidDice, makeDiceOnChange,
  isValidID, makeIDOnChange,
  isValidSignedInt,
  isValidUnsignedInt, makeUnsignedIntOnChange,
} from '../../utils';


const prefix = 'TRAININGPACKAGE_';
const showDescriptionTooltipStorageKey = 'trainingPackages.showDescriptionTooltip';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */

type FormState = {
  id: string;
  name: string;
  description: string;
  flavourText: string;

  book: string;

  notes: string[];
  races: string[];

  qualifiers: {
    qualifier: string;
    reduction: string;
  }[];

  lifestyle: boolean;
  timeToAcquire: string;
  startingMoneyModifierDice: string;

  specials: {
    value: string;
    chance: string;
  }[];

  statGains: Stat[];
  realmStatGain: boolean;

  statGainChoices?: {
    numChoices: string;
    options: Stat[];
  } | undefined;

  /* -------------------------------- */
  /* Skill ranks                      */
  /* -------------------------------- */

  skillRanks: {
    id: string;
    subcategory?: string | undefined;
    value: string;
  }[];

  skillRankChoices: {
    numChoices: string;
    value: string;
    options: {
      id: string;
      subcategory?: string | undefined;
    }[];
  }[];

  /* -------------------------------- */
  /* Category / group ranks           */
  /* -------------------------------- */

  categoryRanks: {
    id: string;
    value: string;
  }[];

  categoryMultiSkillRankChoices: {
    id: string;
    value: string;
    numChoices: string;
  }[];

  groupMultiSkillRankChoices: {
    id: string;
    value: string;
    numChoices: string;
  }[];

  groupCategoryAndSkillRankChoices: {
    id: string;
    value: string;
  }[];

  /* -------------------------------- */
  /* Spell lists                      */
  /* -------------------------------- */

  spellListRanks: {
    optionalCategory?: string | undefined;
    value: string;
    numChoices: string;
    options: string[];
  }[];

  spellListCategoryRankChoices: {
    value: string;
    numChoices: string;
    options: string[];
  }[];

  /* -------------------------------- */
  /* Lifestyle                        */
  /* -------------------------------- */

  lifestyleSkills: {
    id: string;
    subcategory?: string | undefined;
  }[];

  lifestyleCategories: string[];
  lifestyleGroups: string[];

  lifestyleCategorySkillChoices: {
    numChoices: string;
    options: string[];
  }[];

  /* -------------------------------- */
  /* Languages                        */
  /* -------------------------------- */

  languageChoices: {
    numChoices: string;
    value: string;
    options: string[];
  }[];
};

type FormErrors = {
  id?: string;
  name?: string;
  book?: string;

  races?: string;
  notes?: string;
  qualifiers?: string;
  specials?: string;

  timeToAcquire?: string;
  startingMoneyModifierDice?: string;

  statGains?: string;
  statGainChoices?: string;

  skillRanks?: string;
  skillRankChoices?: string;

  categoryRanks?: string;
  categoryMultiSkillRankChoices?: string;
  groupMultiSkillRankChoices?: string;
  groupCategoryAndSkillRankChoices?: string;

  spellListRanks?: string;
  spellListCategoryRankChoices?: string;

  lifestyleSkills?: string;
  lifestyleCategories?: string;
  lifestyleCategorySkillChoices?: string;
  lifestyleGroups?: string;

  languageChoices?: string;

  _form?: string;
};

const emptyVM = (): FormState => ({
  id: prefix,
  name: '',
  description: '',
  flavourText: '',

  book: '',

  notes: [],
  races: [],

  qualifiers: [],

  lifestyle: false,
  timeToAcquire: '',
  startingMoneyModifierDice: '',

  specials: [],

  statGains: [],
  realmStatGain: false,
  statGainChoices: undefined,

  skillRanks: [],
  skillRankChoices: [],

  categoryRanks: [],

  categoryMultiSkillRankChoices: [],

  groupMultiSkillRankChoices: [],

  groupCategoryAndSkillRankChoices: [],

  spellListRanks: [],

  spellListCategoryRankChoices: [],

  lifestyleSkills: [],
  lifestyleCategories: [],
  lifestyleGroups: [],

  lifestyleCategorySkillChoices: [],

  languageChoices: [],
});

const toVM = (x: TrainingPackage): FormState => ({
  id: x.id,
  name: x.name,
  description: x.description ?? '',
  flavourText: x.flavourText ?? '',

  book: x.book,

  notes: x.notes ?? [],
  races: x.races ?? [],

  qualifiers: (x.qualifiers ?? []).map((q) => ({
    qualifier: q.qualifier,
    reduction: String(q.reduction),
  })),

  lifestyle: !!x.lifestyle,
  timeToAcquire: String(x.timeToAcquire ?? ''),
  startingMoneyModifierDice: x.startingMoneyModifierDice ?? '',

  specials: (x.specials ?? []).map((s) => ({
    value: s.value,
    chance: String(s.chance),
  })),

  statGains: x.statGains ?? [],
  realmStatGain: !!x.realmStatGain,

  statGainChoices: x.statGainChoices
    ? {
      numChoices: String(x.statGainChoices.numChoices),
      options: x.statGainChoices.options.slice(),
    }
    : undefined,

  skillRanks: (x.skillRanks ?? []).map((r) => ({
    id: r.id,
    subcategory: r.subcategory,
    value: String(r.value),
  })),

  skillRankChoices: (x.skillRankChoices ?? []).map((r) => ({
    numChoices: String(r.numChoices),
    value: String(r.value),
    options: r.options.map((o) => ({
      id: o.id,
      subcategory: o.subcategory,
    })),
  })),

  categoryRanks: (x.categoryRanks ?? []).map((r) => ({
    id: r.id,
    value: String(r.value),
  })),

  categoryMultiSkillRankChoices: (x.categoryMultiSkillRankChoices ?? []).map((r) => ({
    id: r.id,
    value: String(r.value),
    numChoices: String(r.numChoices),
  })),

  groupMultiSkillRankChoices: (x.groupMultiSkillRankChoices ?? []).map((r) => ({
    id: r.id,
    value: String(r.value),
    numChoices: String(r.numChoices),
  })),

  groupCategoryAndSkillRankChoices: (x.groupCategoryAndSkillRankChoices ?? []).map((r) => ({
    id: r.id,
    value: String(r.value),
  })),

  spellListRanks: (x.spellListRanks ?? []).map((r) => ({
    optionalCategory: r.optionalCategory,
    value: String(r.value),
    numChoices: String(r.numChoices),
    options: r.options.slice(),
  })),

  spellListCategoryRankChoices: (x.spellListCategoryRankChoices ?? []).map((r) => ({
    value: String(r.value),
    numChoices: String(r.numChoices),
    options: r.options.slice(),
  })),

  lifestyleSkills: (x.lifestyleSkills ?? []).map((r) => ({
    id: r.id,
    subcategory: r.subcategory,
  })),

  lifestyleCategories: x.lifestyleCategories ?? [],
  lifestyleGroups: x.lifestyleGroups ?? [],

  lifestyleCategorySkillChoices: (x.lifestyleCategorySkillChoices ?? []).map((r) => ({
    numChoices: String(r.numChoices),
    options: r.options.slice(),
  })),

  languageChoices: (x.languageChoices ?? []).map((r) => ({
    numChoices: String(r.numChoices),
    value: String(r.value),
    options: r.options.slice(),
  })),
});

const fromVM = (vm: FormState): TrainingPackage => ({
  id: vm.id.trim(),
  name: vm.name.trim(),
  description: vm.description.trim() || undefined,
  flavourText: vm.flavourText.trim() || undefined,

  book: vm.book,

  notes: vm.notes.filter((n) => n.trim()),
  races: vm.races.slice(),

  qualifiers: vm.qualifiers.map((q) => ({
    qualifier: q.qualifier.trim(),
    reduction: Number(q.reduction),
  })),

  lifestyle: !!vm.lifestyle,
  timeToAcquire: Number(vm.timeToAcquire),
  startingMoneyModifierDice: vm.startingMoneyModifierDice.trim(),

  specials: vm.specials.map((s) => ({
    value: s.value.trim(),
    chance: Number(s.chance),
  })),

  statGains: vm.statGains.slice(),
  realmStatGain: !!vm.realmStatGain,

  statGainChoices: vm.statGainChoices
    ? {
      numChoices: Number(vm.statGainChoices.numChoices),
      options: vm.statGainChoices.options.slice(),
    }
    : undefined,

  skillRanks: vm.skillRanks.map((r) => ({
    id: r.id,
    subcategory: r.subcategory?.trim() || undefined,
    value: Number(r.value),
  })),

  skillRankChoices: vm.skillRankChoices.map((r) => ({
    numChoices: Number(r.numChoices),
    value: Number(r.value),
    options: r.options.map((o) => ({
      id: o.id,
      subcategory: o.subcategory?.trim() || undefined,
    })),
  })),

  categoryRanks: vm.categoryRanks.map((r) => ({
    id: r.id,
    value: Number(r.value),
  })),

  categoryMultiSkillRankChoices: vm.categoryMultiSkillRankChoices.map((r) => ({
    id: r.id,
    value: Number(r.value),
    numChoices: Number(r.numChoices),
  })),

  groupMultiSkillRankChoices: vm.groupMultiSkillRankChoices.map((r) => ({
    id: r.id,
    value: Number(r.value),
    numChoices: Number(r.numChoices),
  })),

  groupCategoryAndSkillRankChoices: vm.groupCategoryAndSkillRankChoices.map((r) => ({
    id: r.id,
    value: Number(r.value),
  })),

  spellListRanks: vm.spellListRanks.map((r) => ({
    optionalCategory: r.optionalCategory || undefined,
    value: Number(r.value),
    numChoices: Number(r.numChoices),
    options: r.options.slice(),
  })),

  spellListCategoryRankChoices: vm.spellListCategoryRankChoices.map((r) => ({
    value: Number(r.value),
    numChoices: Number(r.numChoices),
    options: r.options.slice(),
  })),

  lifestyleSkills: vm.lifestyleSkills.map((r) => ({
    id: r.id,
    subcategory: r.subcategory?.trim() || undefined,
  })),

  lifestyleCategories: vm.lifestyleCategories.slice(),
  lifestyleGroups: vm.lifestyleGroups.slice(),

  lifestyleCategorySkillChoices: vm.lifestyleCategorySkillChoices.map((r) => ({
    numChoices: Number(r.numChoices),
    options: r.options.slice(),
  })),

  languageChoices: vm.languageChoices.map((r) => ({
    numChoices: Number(r.numChoices),
    value: Number(r.value),
    options: r.options.slice(),
  })),
});

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */

export default function TrainingPackagesView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<TrainingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  const [books, setBooks] = useState<Book[]>([]);
  const [races, setRaces] = useState<any[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [groups, setGroups] = useState<SkillGroup[]>([]);
  const [spellLists, setSpellLists] = useState<SpellList[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);

  const [query, setQuery] = useState('');
  const [lifestyleFilter, setLifestyleFilter] = useState('');
  const [bookFilters, setBookFilters] = useState<string[]>([]);
  const [raceFilters, setRaceFilters] = useState<string[]>([]);
  const [anyRaceOnlyFilter, setAnyRaceOnlyFilter] = useState(false);
  const [showDescriptionTooltip, setShowDescriptionTooltip] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(showDescriptionTooltipStorageKey);
      return raw === null ? true : raw === 'true';
    } catch {
      return true;
    }
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());

  const [previewFlavourText, setPreviewFlavourText] = useState(false);
  const [previewDescription, setPreviewDescription] = useState(false);

  const toast = useToast();
  const confirm = useConfirm();

  /* ------------------------------------------------------------------ */
  /* Load data                                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    (async () => {
      try {
        const [tp, b, r, s, c, g, sl, l] = await Promise.all([
          fetchTrainingPackages(),
          fetchBooks(),
          fetchRaces(),
          fetchSkills(),
          fetchSkillCategories(),
          fetchSkillGroups(),
          fetchSpellLists(),
          fetchLanguages(),
        ]);
        setRows(tp.map((pkg) => ({
          ...pkg,
          races: Array.isArray(pkg.races) ? pkg.races : [],
        })));
        setBooks(b);
        setRaces(r);
        setSkills(s);
        setCategories(c);
        setGroups(g);
        setSpellLists(sl);
        setLanguages(l);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ------------------------------------------------------------------ */
  /* Options                                                           */
  /* ------------------------------------------------------------------ */

  const bookOptions = useMemo(
    () => books.map((b) => ({ value: b.id, label: b.name })),
    [books],
  );

  const bookNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of books) m.set(b.id, b.name);
    return m;
  }, [books]);

  const sgNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const sg of groups) m.set(sg.id, sg.name);
    return m;
  }, [groups]);

  const raceOptions = useMemo(
    () => races.map((r) => ({ value: r.id, label: r.name })),
    [races],
  );

  const raceNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of races) m.set(r.id, r.name);
    return m;
  }, [races]);

  const raceFilterOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const row of rows) {
      if (!Array.isArray(row.races)) continue;
      for (const raceId of row.races) {
        if (raceId) ids.add(raceId);
      }
    }

    return Array.from(ids)
      .map((id) => ({ value: id, label: raceNameById.get(id) ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, raceNameById]);

  const bookFilterOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.book) ids.add(row.book);
    }

    return Array.from(ids)
      .map((id) => ({ value: id, label: bookNameById.get(id) ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, bookNameById]);

  useEffect(() => {
    const allowed = new Set(raceFilterOptions.map((o) => o.value));
    setRaceFilters((prev) => prev.filter((id) => allowed.has(id)));
  }, [raceFilterOptions]);

  useEffect(() => {
    const allowed = new Set(bookFilterOptions.map((o) => o.value));
    setBookFilters((prev) => prev.filter((id) => allowed.has(id)));
  }, [bookFilterOptions]);

  useEffect(() => {
    try {
      localStorage.setItem(showDescriptionTooltipStorageKey, String(showDescriptionTooltip));
    } catch {
      // ignore persistence failures (e.g. private mode)
    }
  }, [showDescriptionTooltip]);

  const skillOptions = useMemo(
    () => skills.map((s) => ({ value: s.id, label: s.name })),
    [skills],
  );

  const categoryOptions = useMemo(
    () => categories.map(c => ({ value: c.id, label: `(${sgNameById.get(c.group) ?? c.group}) - ${c.name}` })),
    [categories, sgNameById],
  );

  const spellCategoryOptions = useMemo(
    () => categories
      .filter((c) => c.group === 'SKILLGROUP_SPELLS')
      .map((c) => ({ value: c.id, label: `(${sgNameById.get(c.group) ?? c.group}) - ${c.name}` })),
    [categories, sgNameById],
  );

  const groupOptions = useMemo(
    () => groups.map((g) => ({ value: g.id, label: g.name })),
    [groups],
  );

  const spellListOptions = useMemo(
    () => spellLists.map((s) => ({ value: s.id, label: s.name })),
    [spellLists],
  );

  const languageOptions = useMemo(
    () => languages.map((l) => ({ value: l.id, label: l.name })),
    [languages],
  );
  const spellCategoryIdSet = useMemo(
    () => new Set(spellCategoryOptions.map((opt) => opt.value)),
    [spellCategoryOptions],
  );
  const statOptions = useMemo(
    () => STATS.map(v => ({ value: v, label: v })),
    []
  );

  /* ------------------------------------------------------------------ */
  /* Validation                                                          */
  /* ------------------------------------------------------------------ */
  const computeErrors = (draft: FormState): FormErrors => {
    const e: FormErrors = {};

    /* -------------------------------------------------- */
    /* Basic fields                                       */
    /* -------------------------------------------------- */

    const id = draft.id.trim();
    const name = draft.name.trim();

    if (!id) e.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === id)) e.id = `ID "${id}" already exists`;
    else if (!isValidID(id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;

    if (!name) {
      e.name = 'Name is required';
    }

    if (!draft.book) {
      e.book = 'Book is required';
    }

    /* -------------------------------------------------- */
    /* Timing / money                                     */
    /* -------------------------------------------------- */

    if (!draft.timeToAcquire || !isValidUnsignedInt(draft.timeToAcquire)) {
      e.timeToAcquire = 'Time to acquire must be a positive integer';
    }

    if (draft.startingMoneyModifierDice) {
      if (!isValidDice(draft.startingMoneyModifierDice.trim())) {
        e.startingMoneyModifierDice = 'Starting money modifier is required';
      }
    }

    /* -------------------------------------------------- */
    /* Races                                              */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.races.length; i++) {
      const r = draft.races[i];

      if (!r) {
        e.races = `Race ${i + 1}: value is required`;
        break;
      }
    }

    /* -------------------------------------------------- */
    /* Qualifiers                                         */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.qualifiers.length; i++) {
      const q = draft.qualifiers[i];
      if (!q) continue;
      if (!q.qualifier.trim()) {
        e.qualifiers = `Qualifier ${i + 1}: text is required`;
        break;
      }
      if (!isValidSignedInt(q.reduction)) {
        e.qualifiers = `Qualifier ${i + 1}: reduction must be an integer`;
        break;
      }
    }

    /* -------------------------------------------------- */
    /* Specials                                         */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.specials.length; i++) {
      const s = draft.specials[i];
      if (!s) continue;
      if (!s.value.trim()) {
        e.specials = `Special ${i + 1}: text is required`;
        break;
      }
      if (!isValidSignedInt(s.chance)) {
        e.specials = `Special ${i + 1}: chance must be a positive integer`;
        break;
      }
    }

    /* -------------------------------------------------- */
    /* Stat gains                                         */
    /* -------------------------------------------------- */
    if (draft.statGainChoices) {
      const { numChoices, options } = draft.statGainChoices;

      if (!isValidUnsignedInt(numChoices)) {
        e.statGainChoices = 'Number of stat choices must be a positive integer';
      } else if (Number(numChoices) <= 0) {
        e.statGainChoices = 'Number of stat choices must be greater than zero';
      } else if (Number(numChoices) > options.length) {
        e.statGainChoices = 'Number of choices exceeds available options';
      }

      if (!options.length) {
        e.statGainChoices = 'Select at least one stat option';
      }
    }

    /* -------------------------------------------------- */
    /* Skill ranks                                        */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.skillRanks.length; i++) {
      const r = draft.skillRanks[i];
      if (!r) continue;

      if (!r.id) {
        e.skillRanks = `SkillRanks[${i + 1}]: skill required`;
        break;
      }

      if (!isValidUnsignedInt(r.value)) {
        e.skillRanks = `SkillRanks[${i + 1}]: ranks must be a positive integer`;
        break;
      }
    }

    /* -------------------------------------------------- */
    /* Skill rank choices                                 */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.skillRankChoices.length; i++) {
      const r = draft.skillRankChoices[i];
      if (!r) continue;

      if (!isValidUnsignedInt(r.value) || Number(r.value) <= 0) {
        e.skillRankChoices = `SkillRankChoices[${i + 1}]: total ranks must be a positive integer`;
        break;
      }

      if (!isValidUnsignedInt(r.numChoices) || Number(r.numChoices) <= 0) {
        e.skillRankChoices = `SkillRankChoices[${i + 1}]: number of choices must be a positive integer`;
        break;
      } else if (Number(r.value) < Number(r.numChoices)) {
        e.skillRankChoices = `SkillRankChoices[${i + 1}]: number of choices cannot exceed total ranks`;
        break;
      }

      if (r.options.length < Number(r.numChoices)) {
        e.skillRankChoices = `SkillRankChoices[${i + 1}]: number of skill options must be at least ${r.numChoices}`;
        break;
      }

      for (let j = 0; j < r.options.length; j++) {
        const option = r.options[j];
        if (!option) continue;
        if (!option.id) {
          e.skillRankChoices =
            `SkillRankChoices[${i + 1}].options[${j + 1}]: skill required`;
          break;
        }
      }

      if (e.skillRankChoices) break;
    }

    /* -------------------------------------------------- */
    /* Category ranks                                     */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.categoryRanks.length; i++) {
      const r = draft.categoryRanks[i];
      if (!r) continue;

      if (!r.id) {
        e.categoryRanks = `CategoryRanks[${i + 1}]: category required`;
        break;
      }

      if (!isValidUnsignedInt(r.value)) {
        e.categoryRanks = `CategoryRanks[${i + 1}]: ranks must be a positive integer`;
        break;
      }
    }

    /* -------------------------------------------------- */
    /* Category multi-skill rank choices                  */
    /* -------------------------------------------------- */
    for (let i = 0; i < draft.categoryMultiSkillRankChoices.length; i++) {
      const r = draft.categoryMultiSkillRankChoices[i];
      if (!r) continue;
      if (!r.id) {
        e.categoryMultiSkillRankChoices =
          `CategoryMultiSkillRankChoices[${i + 1}]: category required`;
        break;
      }

      if (!isValidUnsignedInt(r.value) || Number(r.value) <= 0) {
        e.categoryMultiSkillRankChoices =
          `CategoryMultiSkillRankChoices[${i + 1}]: total ranks must be a positive integer`;
        break;
      }

      if (!isValidUnsignedInt(r.numChoices) || Number(r.numChoices) <= 0) {
        e.categoryMultiSkillRankChoices =
          `CategoryMultiSkillRankChoices[${i + 1}]: number of choices must be a positive integer`;
        break;
      } else if (Number(r.value) < Number(r.numChoices)) {
        e.categoryMultiSkillRankChoices = `CategoryMultiSkillRankChoices[${i + 1}]: number of choices cannot exceed total ranks`;
        break;
      }
    }

    /* -------------------------------------------------- */
    /* Group multi-skill rank choices                     */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.groupMultiSkillRankChoices.length; i++) {
      const r = draft.groupMultiSkillRankChoices[i];
      if (!r) continue;
      if (!r.id) {
        e.groupMultiSkillRankChoices =
          `GroupMultiSkillRankChoices[${i + 1}]: group required`;
        break;
      }

      if (!isValidUnsignedInt(r.value) || Number(r.value) <= 0) {
        e.groupMultiSkillRankChoices = `GroupMultiSkillRankChoices[${i + 1}]: total ranks must be a positive integer`;
        break;
      }

      if (!isValidUnsignedInt(r.numChoices) || Number(r.numChoices) <= 0) {
        e.groupMultiSkillRankChoices = `GroupMultiSkillRankChoices[${i + 1}]: number of choices must be a positive integer`;
        break;
      } else if (Number(r.value) < Number(r.numChoices)) {
        e.groupMultiSkillRankChoices = `GroupMultiSkillRankChoices[${i + 1}]: number of choices cannot exceed total ranks`;
        break;
      }
    }

    /* -------------------------------------------------- */
    /* Group category & skill rank choices                */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.groupCategoryAndSkillRankChoices.length; i++) {
      const r = draft.groupCategoryAndSkillRankChoices[i];
      if (!r) continue;
      if (!r.id) {
        e.groupCategoryAndSkillRankChoices = `GroupCategoryAndSkillRankChoices[${i + 1}]: group required`;
        break;
      }

      if (!isValidUnsignedInt(r.value)) {
        e.groupCategoryAndSkillRankChoices = `GroupCategoryAndSkillRankChoices[${i + 1}]: number of ranks must be positive`;
        break;
      }
    }

    /* -------------------------------------------------- */
    /* Spell list ranks                                   */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.spellListRanks.length; i++) {
      const r = draft.spellListRanks[i];
      if (!r) continue;

      if (!isValidUnsignedInt(r.value) || Number(r.value) <= 0) {
        e.spellListRanks = `SpellListRanks[${i + 1}]: total ranks must be positive`;
        break;
      }

      if (!isValidUnsignedInt(r.numChoices) || Number(r.numChoices) <= 0) {
        e.spellListRanks = `SpellListRanks[${i + 1}]: number of spell lists to select must be positive`;
        break;
      } else if (Number(r.value) < Number(r.numChoices)) {
        e.spellListRanks = `SpellListRanks[${i + 1}]: number of spell lists to select cannot exceed total ranks`;
        break;
      }

      if (!r.options.length) {
        e.spellListRanks = `SpellListRanks[${i + 1}]: select at least one spell list`;
        break;
      } else if (r.options.length < Number(r.numChoices)) {
        e.spellListRanks = `SpellListRanks[${i + 1}]: number of spell lists to select from must be at least as many as the number of spell lists to select`;
        break;
      }
    }

    /* -------------------------------------------------- */
    /* Spell list category rank choices                   */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.spellListCategoryRankChoices.length; i++) {
      const r = draft.spellListCategoryRankChoices[i];
      if (!r) continue;

      if (!isValidUnsignedInt(r.value) || Number(r.value) <= 0) {
        e.spellListCategoryRankChoices = `SpellListCategoryRankChoices[${i + 1}]: total ranks must be positive`;
        break;
      }

      if (!isValidUnsignedInt(r.numChoices) || Number(r.numChoices) <= 0) {
        e.spellListCategoryRankChoices = `SpellListCategoryRankChoices[${i + 1}]: number of categories to select must be positive`;
        break;
      } else if (Number(r.value) < Number(r.numChoices)) {
        e.spellListCategoryRankChoices = `SpellListCategoryRankChoices[${i + 1}]: number of categories to select cannot exceed total ranks`;
        break;
      }
      if (!r.options.length) {
        e.spellListCategoryRankChoices = `SpellListCategoryRankChoices[${i + 1}]: select at least one category`;
        break;
      } else if (r.options.length < Number(r.numChoices)) {
        e.spellListCategoryRankChoices = `SpellListCategoryRankChoices[${i + 1}]: number of categories to select from must be at least as many as the number of categories to select`;
        break;
      }

      if (r.options.some((optionId) => !spellCategoryIdSet.has(optionId))) {
        e.spellListCategoryRankChoices = `SpellListCategoryRankChoices[${i + 1}]: all categories must belong to SKILLGROUP_SPELLS`;
        break;
      }
    }
    /* -------------------------------------------------- */
    /* Lifestyle                                          */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.lifestyleSkills.length; i++) {
      const r = draft.lifestyleSkills[i];
      if (!r) continue;
      if (!r.id) {
        e.lifestyleSkills = `LifestyleSkills[${i + 1}]: skill required`;
        break;
      }
    }

    if (draft.lifestyleCategories.some((c) => !c)) {
      e.lifestyleCategories = 'Lifestyle categories contain empty values';
    }

    if (draft.lifestyleGroups.some((g) => !g)) {
      e.lifestyleGroups = 'Lifestyle groups contain empty values';
    }

    /* -------------------------------------------------- */
    /* Lifestyle category skill choices                   */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.lifestyleCategorySkillChoices.length; i++) {
      const r = draft.lifestyleCategorySkillChoices[i];
      if (!r) continue;

      if (!isValidUnsignedInt(r.numChoices) || Number(r.numChoices) <= 0) {
        e.lifestyleCategorySkillChoices =
          `LifestyleCategorySkillChoices[${i + 1}]: number of choices must be positive`;
        break;
      }

      if (!r.options.length) {
        e.lifestyleCategorySkillChoices =
          `LifestyleCategorySkillChoices[${i + 1}]: select at least one category`;
        break;
      } else if (r.options.length < Number(r.numChoices)) {
        e.lifestyleCategorySkillChoices =
          `LifestyleCategorySkillChoices[${i + 1}]: number of categories to select from must be at least as many as the number of categories to select`;
        break;
      }
    }

    /* -------------------------------------------------- */
    /* Language choices                                   */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.languageChoices.length; i++) {
      const r = draft.languageChoices[i];
      if (!r) continue;

      if (!isValidUnsignedInt(r.value) || Number(r.value) <= 0) {
        e.languageChoices = `LanguageChoices[${i + 1}]: number of ranks to spend must be positive`;
        break;
      }

      if (!isValidUnsignedInt(r.numChoices) || Number(r.numChoices) <= 0) {
        e.languageChoices = `LanguageChoices[${i + 1}]: number of languages to select must be positive`;
        break;
      } else if (Number(r.value) < Number(r.numChoices)) {
        e.languageChoices = `LanguageChoices[${i + 1}]: number of choices cannot exceed number of ranks to spend`;
        break;
      }

      if (!r.options.length) {
        e.languageChoices = `LanguageChoices[${i + 1}]: select at least one language`;
        break;
      } else if (r.options.length < Number(r.numChoices)) {
        e.languageChoices = `LanguageChoices[${i + 1}]: number of choices cannot exceed number of available languages`;
        break;
      }
    }

    return e;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing]);

  /* ------------------------------------------------------------------ */
  /* Table                                                             */
  /* ------------------------------------------------------------------ */

  const getRowRaces = (r: TrainingPackage): string[] => (Array.isArray(r.races) ? r.races : []);

  const columns: ColumnDef<TrainingPackage>[] = [
    { id: 'id', header: 'ID', accessor: (r) => r.id, minWidth: 260 },
    { id: 'name', header: 'Name', accessor: (r) => r.name, minWidth: 180 },
    {
      id: 'book',
      header: 'Book',
      accessor: r => bookNameById.get(r.book) ?? r.book,
      sortType: 'string',
      minWidth: 180,
      render: r => {
        const label = bookNameById.get(r.book);
        return label ? label : r.book;
      },
    },
    {
      id: 'lifestyle',
      header: 'Lifestyle',
      accessor: (r) => Number(r.lifestyle),
      sortType: 'number',
      minWidth: 110,
      render: (r) => (r.lifestyle ? 'Yes' : 'No'),
    },
    {
      id: 'races',
      header: 'Races',
      accessor: (r) => getRowRaces(r).length,
      sortType: 'number',
      minWidth: 280,
      render: (r) => getRowRaces(r).map((id) => raceNameById.get(id) ?? id).join(', '),
    },
    {
      id: 'actions',
      header: 'Actions',
      sortable: false,
      width: 360,
      render: (row) => (
        <>
          <button onClick={() => startView(row)}>View</button>
          <button onClick={() => startEdit(row)}>Edit</button>
          <button onClick={() => startDuplicate(row)}>Duplicate</button>
          <button onClick={() => onDelete(row)} style={{ color: '#b00020' }}>
            Delete
          </button>
        </>
      ),
    },
  ];

  const filteredRows = useMemo(
    () => rows.filter((r) => {
      const rowRaces = getRowRaces(r);
      if (lifestyleFilter !== '' && r.lifestyle !== (lifestyleFilter === 'true')) return false;
      if (bookFilters.length > 0 && !bookFilters.includes(r.book)) return false;
      if (anyRaceOnlyFilter && rowRaces.length > 0) return false;
      if (!anyRaceOnlyFilter && raceFilters.length > 0 && !raceFilters.every((raceId) => rowRaces.includes(raceId))) return false;
      return true;
    }),
    [rows, lifestyleFilter, bookFilters, raceFilters, anyRaceOnlyFilter]
  );

  const hasActiveFilters = lifestyleFilter !== '' || bookFilters.length > 0 || raceFilters.length > 0 || anyRaceOnlyFilter;

  useEffect(() => { setPage(1); }, [lifestyleFilter, bookFilters, raceFilters, anyRaceOnlyFilter]);

  const globalFilter = (r: TrainingPackage, q: string) => {
    const rowRaces = getRowRaces(r);
    return [
      r.id,
      r.name,
      r.description ?? '',
      r.lifestyle ? 'yes' : 'no',
      rowRaces.join(','),
      rowRaces.map((id) => raceNameById.get(id) ?? id).join(','),
    ]
      .some((v) => String(v).toLowerCase().includes(q.toLowerCase()));
  };

  /* ------------------------------------------------------------------ */
  /* Actions                                                           */
  /* ------------------------------------------------------------------ */

  const startNew = () => {
    setViewing(false);
    setEditingId(null);
    setForm(emptyVM());
    setErrors({});
    setShowForm(true);
  };

  const startView = (row: TrainingPackage) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: TrainingPackage) => {
    setForm(toVM(row));
    setEditingId(row.id);
    setViewing(false);
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: TrainingPackage) => {
    setViewing(false);
    setEditingId(null);
    const vm = toVM(row);
    vm.id = prefix;
    vm.name += ' (Copy)';
    setForm(vm);
    setErrors({});
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setViewing(false);
    setEditingId(null);
    setErrors({});
  };

  const saveForm = async () => {

    if (submitting) return;

    const nextErrors = computeErrors(form);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setSubmitting(true);

    const payload = fromVM(form);
    const isEditing = Boolean(editingId);

    try {
      const opts = isEditing
        ? { method: 'PUT' as const }
        : { method: 'POST' as const };

      await upsertTrainingPackage(payload, opts);

      setRows((prev) => {
        if (isEditing) {
          const idx = prev.findIndex((r) => r.id === payload.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...payload };
            return copy;
          }
          return [payload, ...prev];
        }
        return [payload, ...prev];
      });

      setShowForm(false);
      setViewing(false);
      setEditingId(null);

      toast({
        variant: 'success',
        title: isEditing ? 'Updated' : 'Saved',
        description: `Training Package "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
      });
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Save failed',
        description: String(err instanceof Error ? err.message : err),
      });
    } finally {
      setSubmitting(false);
    }

  };

  const onDelete = async (row: TrainingPackage) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Training Package',
      body: `Delete "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows((current) => current.filter((r) => r.id !== row.id));
    setPage(1);

    try {
      await deleteTrainingPackage(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Training Package "${row.id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({
        variant: 'danger',
        title: 'Delete failed',
        description: String(err instanceof Error ? err.message : err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- reusable updaters (guard + narrow + full-object writes) ----------
  const toggleStatArray = (
    key: 'statGains',
    value: Stat
  ) => {
    setForm((s) => {
      const arr = [...(s[key])];
      const ix = arr.indexOf(value);
      if (ix >= 0) arr.splice(ix, 1);
      else arr.push(value);
      return { ...s, [key]: arr };
    });
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                            */
  /* ------------------------------------------------------------------ */

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <>
      <h2>Training Packages</h2>

      {!showForm && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={startNew}>New Training Package</button>
            <DataTableSearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search training packages…"
              aria-label="Search training packages"
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Lifestyle:
              <select value={lifestyleFilter} onChange={(e) => setLifestyleFilter(e.target.value)}>
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={anyRaceOnlyFilter}
                onChange={(e) => setAnyRaceOnlyFilter(e.target.checked)}
              />
              Any race only
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={showDescriptionTooltip}
                onChange={(e) => setShowDescriptionTooltip(e.target.checked)}
              />
              Show description tooltip
            </label>
            {hasActiveFilters && (
              <button onClick={() => { setLifestyleFilter(''); setBookFilters([]); setRaceFilters([]); setAnyRaceOnlyFilter(false); }}>Clear filters</button>
            )}

            {/* Reset and auto-fit column widths */}
            <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
            <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
          </div>

          <details>
            <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
              Books{bookFilters.length > 0 ? ` (${bookFilters.length} selected)` : ''}
            </summary>
            <div style={{ marginTop: 6 }}>
              <CheckboxGroup<string>
                label="Books"
                value={bookFilters}
                options={bookFilterOptions}
                onChange={setBookFilters}
                inline
                showSelectAll
                columns={4}
              />
            </div>
          </details>

          <details>
            <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
              Races{raceFilters.length > 0 ? ` (${raceFilters.length} selected)` : ''}
            </summary>
            <div style={{ marginTop: 6 }}>
              <CheckboxGroup<string>
                label="Races"
                value={raceFilters}
                options={raceFilterOptions}
                onChange={setRaceFilters}
                disabled={anyRaceOnlyFilter}
                {...(anyRaceOnlyFilter ? { helperText: 'Race filters are disabled while "Any race only" is active.' } : {})}
                inline
                showSelectAll
                columns={4}
              />
            </div>
          </details>
        </div>
      )}

      {showForm && (
        <div className="form-container">
          {submitting && (
            <div className="overlay">
              <Spinner size={24} />
              <span>Saving…</span>
            </div>
          )}

          <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`}>
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Training Package</h3>

            {/* Basic */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <LabeledInput
                label="ID"
                value={form.id}
                onChange={makeIDOnChange<typeof form>('id', setForm, prefix)}
                disabled={!!editingId || viewing}
                error={viewing ? undefined : errors.id}
              />
              <LabeledInput
                label="Name"
                value={form.name}
                onChange={(v) => setForm((s) => ({ ...s, name: v }))}
                disabled={viewing}
                error={viewing ? undefined : errors.name}
              />
              <LabeledSelect
                label="Book"
                value={form.book}
                onChange={(v) => setForm((s) => ({ ...s, book: v }))}
                options={bookOptions}
                disabled={viewing}
                error={viewing ? undefined : errors.book}
              />
              {/* Lifestyle */}
              <CheckboxInput
                label="Lifestyle"
                checked={form.lifestyle}
                onChange={(c) => setForm((s) => ({ ...s, lifestyle: c }))}
                disabled={viewing}
              />
              {/* Timing */}
              <LabeledInput
                label="Time to Acquire (months)"
                value={form.timeToAcquire}
                onChange={makeUnsignedIntOnChange<typeof form>('timeToAcquire', setForm)}
                disabled={viewing}
                error={viewing ? undefined : errors.timeToAcquire}
              />
              {/* Starting money modifier */}
              <LabeledInput
                label="Starting Money Modifier (dice notation, e.g. 2d6)"
                value={form.startingMoneyModifierDice}
                onChange={makeDiceOnChange<typeof form>('startingMoneyModifierDice', setForm)}
                disabled={viewing}
                error={viewing ? undefined : errors.startingMoneyModifierDice}
              />
            </div>

            {/* Description */}
            <section style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h4 style={{ margin: '8px 0' }}>Description</h4>
                {!viewing && (
                  <button type="button" onClick={() => setPreviewDescription((p) => !p)}>
                    {previewDescription ? 'Edit' : 'Preview'}
                  </button>
                )}
              </div>
              {previewDescription || viewing ? (
                <MarkupPreview
                  content={form.description}
                  emptyHint="No description"
                  className="preview-html"
                  style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}
                />
              ) : (
                <label style={{ display: 'grid', gap: 6 }}>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                    disabled={viewing}
                    rows={5}
                  />
                </label>
              )}
            </section>

            {/* Flavour Text */}
            <section style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h4 style={{ margin: '8px 0' }}>Flavour Text</h4>
                {!viewing && (
                  <button type="button" onClick={() => setPreviewFlavourText((p) => !p)}>
                    {previewFlavourText ? 'Edit' : 'Preview'}
                  </button>
                )}
              </div>
              {previewFlavourText || viewing ? (
                <MarkupPreview
                  content={form.flavourText}
                  emptyHint="No flavour text"
                  className="preview-html"
                  style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}
                />
              ) : (
                <label style={{ display: 'grid', gap: 6 }}>
                  <textarea
                    value={form.flavourText}
                    onChange={(e) => setForm((s) => ({ ...s, flavourText: e.target.value }))}
                    disabled={viewing}
                    rows={5}
                  />
                </label>
              )}
            </section>

            {/* Notes */}
            {/* Notes are simple HTML strings, so we can reuse the same component for both viewing and editing (with a few tweaks)
            * In viewing mode, we just render the HTML and ignore errors (since the data is already saved and valid)
            * In editing mode, we render an editor that allows adding/removing/reordering notes, and we show validation errors if any
            */}
            {viewing ? (
              <MarkupPreviewList title="Notes" arr={form.notes} viewing />
            ) : (
              <MarkupPreviewList title="Notes" arr={form.notes} viewing={false} error={errors.notes}
                onChangeNotes={(next) => setForm((s) => ({ ...s, notes: next }))}
              />
            )}

            {/* Races */}
            <IdListEditor
              title="Allowed Races"
              addButtonLabel='+ Add race'
              rows={form.races}
              onChangeRows={(next) => setForm((s) => ({ ...s, races: next }))}
              options={raceOptions}
              viewing={viewing}
              error={errors.races}
            />

            {/* Qualifiers */}
            <TextNumberListEditor
              title="Qualifiers"
              addButtonLabel='+ Add qualifier'
              rows={form.qualifiers.map((q) => ({
                text: q.qualifier,
                number: q.reduction,
              }))}
              onChangeRows={(next) =>
                setForm((s) => ({
                  ...s,
                  qualifiers: next.map((r) => ({
                    qualifier: r.text,
                    reduction: r.number,
                  })),
                }))
              }
              textLabel="Qualifier"
              numberLabel="Reduction"
              viewing={viewing}
              error={errors.qualifiers}
            />

            {/* Specials */}
            <TextNumberListEditor
              title="Specials"
              addButtonLabel='+ Add special'
              rows={form.specials.map((s) => ({
                text: s.value,
                number: s.chance,
              }))}
              onChangeRows={(next) =>
                setForm((s) => ({
                  ...s,
                  specials: next.map((r) => ({
                    value: r.text,
                    chance: r.number,
                  })),
                }))
              }
              textLabel="Special"
              numberLabel="Chance (%)"
              viewing={viewing}
              error={errors.specials}
            />

            {/* Stat gains */}
            {/* Realm stat gain is a special case that disables all other stat gain options when enabled */}
            {(!viewing || (form.realmStatGain || form.statGains.length > 0)) && (
              <>
                <h4 style={{ margin: '16px 0 8px' }}>Stat Gains</h4>
                <CheckboxInput
                  label="Realm Stat Gains"
                  checked={form.realmStatGain}
                  onChange={(c) => setForm((s) => ({ ...s, realmStatGain: c, statGains: [] }))}
                  disabled={viewing}
                />
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {statOptions.map((opt) => (
                    <CheckboxInput
                      key={opt.value}
                      label={opt.label}
                      checked={form.statGains.includes(opt.value as Stat)}
                      onChange={() => toggleStatArray('statGains', opt.value as Stat)}
                      disabled={viewing || form.realmStatGain}
                    />
                  ))}
                </div>
                {errors.statGains && <div style={{ color: '#b00020', marginTop: 6 }}>{errors.statGains}</div>}
              </>
            )}

            {/* Stat gain choices */}
            <StatGainChoiceEditor<Stat>
              title="Stat Gain Choices"
              value={form.statGainChoices}
              onChange={(next) =>
                setForm((s) => ({ ...s, statGainChoices: next }))
              }
              statOptions={statOptions}
              viewing={viewing}
              error={errors.statGainChoices}
            />

            {/* Skill Ranks */}
            <SkillValueListEditor
              title="Skill Ranks"
              addButtonLabel='+ Add skill rank'
              idColumnLabel="Skill"
              valueColumnLabel="Ranks"
              rows={form.skillRanks}
              onChangeRows={(next) => setForm((s) => ({ ...s, skillRanks: next }))}
              idOptions={skillOptions}
              viewing={viewing}
              error={errors.skillRanks}
              signedValues={false}
            />

            {/* Skill Rank Choices */}
            <SkillRankChoiceEditor
              title="Skill Rank Choices"
              rows={form.skillRankChoices}
              onChangeRows={(next) =>
                setForm((s) => ({ ...s, skillRankChoices: next }))
              }
              skillOptions={skillOptions}
              viewing={viewing}
              error={errors.skillRankChoices}
            />

            {/* Category Ranks */}
            <IdValueListEditor
              title="Skill Category Ranks"
              addButtonLabel='+ Add category rank'
              idColumnLabel="Category"
              valueColumnLabel="Ranks"
              rows={form.categoryRanks}
              onChangeRows={(next) => setForm((s) => ({ ...s, categoryRanks: next }))}
              options={categoryOptions}
              loading={loading}
              viewing={viewing}
              error={errors.categoryRanks}
              signedValues={false}
            />

            {/* Category Multi‑Skill Rank Choices */}
            <IdMultiSkillRankEditor
              title="Category Multi-Skill Rank Choices"
              addButtonLabel='+ Add category rank choice'
              rows={form.categoryMultiSkillRankChoices}
              onChangeRows={(next) =>
                setForm((s) => ({ ...s, categoryMultiSkillRankChoices: next }))
              }
              idOptions={categoryOptions}
              loading={loading}
              viewing={viewing}
              error={errors.categoryMultiSkillRankChoices}
              idColumnLabel="Category"
            />

            {/* Group Multi‑Skill Rank Choices */}
            <IdMultiSkillRankEditor
              title="Group Multi-Skill Rank Choices"
              addButtonLabel='+ Add group rank choice'
              rows={form.groupMultiSkillRankChoices}
              onChangeRows={(next) =>
                setForm((s) => ({ ...s, groupMultiSkillRankChoices: next }))
              }
              idOptions={groupOptions}
              loading={loading}
              viewing={viewing}
              error={errors.groupMultiSkillRankChoices}
              idColumnLabel="Group"
            />

            {/* Group Category & Skill Rank Choices */}
            <IdValueListEditor
              title="Group Category & Skill Rank Choices"
              addButtonLabel='+ Add group rank choice'
              idColumnLabel="Group"
              valueColumnLabel="# Ranks"
              rows={form.groupCategoryAndSkillRankChoices}
              onChangeRows={(next) => setForm((s) => ({ ...s, groupCategoryAndSkillRankChoices: next }))}
              options={groupOptions}
              loading={loading}
              viewing={viewing}
              error={errors.groupCategoryAndSkillRankChoices}
              signedValues
            />

            {/* Spell List Ranks */}
            <SpellListRankEditor
              title="Spell List Ranks"
              rows={form.spellListRanks}
              onChangeRows={(next) =>
                setForm((s) => ({ ...s, spellListRanks: next }))
              }
              categoryOptions={categoryOptions}
              spellListOptions={spellListOptions}
              viewing={viewing}
              error={errors.spellListRanks}
            />

            {/* Spell List Category Rank Choices */}
            <SpellListCategoryRankEditor
              title="Spell List Category Rank Choices"
              rows={form.spellListCategoryRankChoices}
              onChangeRows={(next) =>
                setForm((s) => ({
                  ...s,
                  spellListCategoryRankChoices: next,
                }))
              }
              categoryOptions={spellCategoryOptions}
              viewing={viewing}
              error={errors.spellListCategoryRankChoices}
            />

            {/* Lifestyle Skills */}
            <SkillListEditor
              title="Lifestyle Skills"
              idColumnLabel='Skill'
              addButtonLabel='+ Add lifestyle skill'
              rows={form.lifestyleSkills}
              onChangeRows={(next) => setForm((s) => ({ ...s, lifestyleSkills: next }))}
              idOptions={skillOptions}
              viewing={viewing}
            />

            {/* Lifestyle Categories */}
            <IdListEditor
              title="Lifestyle Categories"
              addButtonLabel='+ Add lifestyle category'
              rows={form.lifestyleCategories}
              onChangeRows={(next) => setForm((s) => ({ ...s, lifestyleCategories: next }))}
              options={categoryOptions}
              viewing={viewing}
            />

            {/* Lifestyle Groups */}
            <IdListEditor
              title="Lifestyle Groups"
              addButtonLabel='+ Add lifestyle group'
              rows={form.lifestyleGroups}
              onChangeRows={(next) => setForm((s) => ({ ...s, lifestyleGroups: next }))}
              options={groupOptions}
              viewing={viewing}
            />

            {/* Lifestyle Category Skill Choices */}
            <ChoiceListEditor<string, string>
              title="Lifestyle Category Skill Choices"
              addRowButtonLabel='+ Add lifestyle category choice'
              optionSectionLabel="Categories"
              numChoicesLabel="# Categories"
              addOptionButtonLabel="+ Add category"
              rows={form.lifestyleCategorySkillChoices.map((r) => ({
                numChoices: r.numChoices,
                type: '',
                options: r.options,
              }))}
              onChangeRows={(next) =>
                setForm((s) => ({
                  ...s,
                  lifestyleCategorySkillChoices: next.map((r) => ({
                    numChoices: r.numChoices,
                    options: r.options,
                  })),
                }))
              }
              typeOptions={[]}
              createEmptyOption={() => ''}
              viewing={viewing}
              error={errors.lifestyleCategorySkillChoices}
              renderOptionEditor={({ option, setOption, removeOption, viewing }) => (
                <div style={{ display: 'grid', gridTemplateColumns: viewing ? '1fr' : '1fr auto', gap: 8 }}>
                  <LabeledSelect
                    label="Category"
                    hideLabel
                    value={option}
                    options={categoryOptions}
                    disabled={viewing}
                    onChange={setOption}
                  />
                  {!viewing && <button onClick={removeOption} style={{ color: '#b00020' }}>Remove</button>}
                </div>
              )}
            />

            {/* Language Choices */}
            <LanguageChoiceEditor
              title="Language Choices"
              rows={form.languageChoices}
              onChangeRows={(next) =>
                setForm((s) => ({ ...s, languageChoices: next }))
              }
              languageOptions={languageOptions}
              viewing={viewing}
              error={errors.languageChoices}
            />

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {!viewing && <button onClick={saveForm} disabled={hasErrors || submitting}>{submitting ? 'Submitting…' : 'Save'}</button>}
              <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
            </div>

            {/* Validation errors */}
            {Object.values(errors).some(Boolean) && (
              <div style={{ marginTop: 12, color: '#b00020' }}>
                <h4 style={{ margin: '0 0 4px' }}>Please fix the following errors:</h4>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {Object.entries(errors).map(([field, error]) =>
                    error ? <li key={field}>{error}</li> : null
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {!showForm && (
        <DataTable
          ref={dtRef}
          rows={filteredRows}
          columns={columns}
          rowId={(r) => r.id}
          rowHoverTooltip={(row) => {
            if (!showDescriptionTooltip) return null;
            if (!row.description?.trim()) return null;
            return (
              <MarkupPreview
                content={row.description}
                format="html"
                emptyHint=""
                className="preview-html"
              />
            );
          }}
          initialSort={{ colId: 'name', dir: 'asc' }} //
          // search
          searchQuery={query}
          globalFilter={globalFilter}
          // pagination (client)
          mode="client"
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          // styles
          tableMinWidth={0} // allow table to shrink below container width (for better mobile support)
          persistKey="dt.trainingPackages.v1"
          ariaLabel='Training Package data'
        />
      )}
    </>
  );
}