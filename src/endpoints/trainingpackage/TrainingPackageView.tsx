import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DataTable,
  DataTableSearchInput,
  type ColumnDef,
  type DataTableHandle,
} from '../../components/DataTable';

import {
  CheckboxInput,
  ChoiceListEditor,
  HtmlPreview,
  HtmlPreviewList,
  IdListEditor,
  IdMultiSkillRankEditor,
  IdValueListEditor,
  LabeledInput,
  LabeledSelect,
  LanguageChoiceEditor,
  SkillListEditor,
  SkillRankChoiceEditor,
  SkillValueListEditor,
  SpellListCategoryRankEditor,
  SpellListRankEditor,
  StatGainChoiceEditor,
  TextNumberListEditor,
} from '../../components/inputs';

import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

import {
  fetchTrainingPackages,
  upsertTrainingPackage,
  deleteTrainingPackage,
} from '../../api/trainingpackage';

import { fetchBooks } from '../../api/book';
import { fetchRaces } from '../../api/race';
import { fetchSkills } from '../../api/skill';
import { fetchSkillcategories } from '../../api/skillcategory';
import { fetchSkillgroups } from '../../api/skillgroup';
import { fetchSpelllists } from '../../api/spelllist';
import { fetchLanguages } from '../../api/language';

import type { TrainingPackage } from '../../types/trainingpackage';
import type { Book } from '../../types/book';
import type { Skill } from '../../types/skill';
import type { SkillCategory } from '../../types/skillcategory';
import type { SkillGroup } from '../../types/skillgroup';
import type { SpellList } from '../../types/spelllist';
import type { Language } from '../../types/language';

import {
  STATS,
  type Stat,
} from '../../types/enum';
import { isValidID, makeIDOnChange, isValidUnsignedInt, makeUnsignedIntOnChange, isValidSignedInt } from '../../utils/inputHelpers';


const prefix = 'TRAININGPACKAGE_';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */

type QualifierVM = {
  qualifier: string;
  reduction: string;
};

type SpecialVM = {
  value: string;
  chance: string;
};

type StatGainChoiceVM = {
  numChoices: string;
  options: Stat[];
};

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
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
          fetchSkillcategories(),
          fetchSkillgroups(),
          fetchSpelllists(),
          fetchLanguages(),
        ]);
        setRows(tp);
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

  const raceOptions = useMemo(
    () => races.map((r) => ({ value: r.id, label: r.name })),
    [races],
  );

  const skillOptions = useMemo(
    () => skills.map((s) => ({ value: s.id, label: s.name })),
    [skills],
  );

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
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
    /* Races                                              */
    /* -------------------------------------------------- */

    if (!draft.races.length) {
      e.races = 'Select at least one allowed race';
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
    /* Timing / money                                     */
    /* -------------------------------------------------- */

    if (draft.timeToAcquire && !isValidUnsignedInt(draft.timeToAcquire)) {
      e.timeToAcquire = 'Time to acquire must be a positive integer';
    }

    if (!draft.startingMoneyModifierDice.trim()) {
      e.startingMoneyModifierDice = 'Starting money modifier is required';
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
        e.skillRanks = `SkillRanks[${i + 1}]: skill is required`;
        break;
      }

      if (!isValidUnsignedInt(r.value)) {
        e.skillRanks = `SkillRanks[${i + 1}]: value must be a positive integer`;
        break;
      }
    }

    /* -------------------------------------------------- */
    /* Skill rank choices                                 */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.skillRankChoices.length; i++) {
      const r = draft.skillRankChoices[i];
      if (!r) continue;

      if (!isValidUnsignedInt(r.numChoices) || Number(r.numChoices) <= 0) {
        e.skillRankChoices = `SkillRankChoices[${i + 1}]: numChoices must be a positive integer`;
        break;
      }

      if (!isValidUnsignedInt(r.value) || Number(r.value) <= 0) {
        e.skillRankChoices = `SkillRankChoices[${i + 1}]: rank value must be positive`;
        break;
      }

      if (!r.options.length) {
        e.skillRankChoices = `SkillRankChoices[${i + 1}]: at least one skill option required`;
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
        e.categoryRanks = `CategoryRanks[${i + 1}]: value must be a positive integer`;
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
          `CategoryMultiSkillRankChoices[${i + 1}]: value must be a positive integer`;
        break;
      }

      if (!isValidUnsignedInt(r.numChoices) || Number(r.numChoices) <= 0) {
        e.categoryMultiSkillRankChoices =
          `CategoryMultiSkillRankChoices[${i + 1}]: numChoices must be a positive integer`;
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
        e.groupMultiSkillRankChoices =
          `GroupMultiSkillRankChoices[${i + 1}]: value must be a positive integer`;
        break;
      }

      if (!isValidUnsignedInt(r.numChoices) || Number(r.numChoices) <= 0) {
        e.groupMultiSkillRankChoices =
          `GroupMultiSkillRankChoices[${i + 1}]: numChoices must be a positive integer`;
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
        e.groupCategoryAndSkillRankChoices = `GroupCategoryAndSkillRankChoices[${i + 1}]: value must be positive`;
        break;
      }
    }

    /* -------------------------------------------------- */
    /* Spell list ranks                                   */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.spellListRanks.length; i++) {
      const r = draft.spellListRanks[i];
      if (!r) continue;

      if (!isValidUnsignedInt(r.numChoices) || Number(r.numChoices) <= 0) {
        e.spellListRanks = `SpellListRanks[${i + 1}]: numChoices must be positive`;
        break;
      }

      if (!isValidUnsignedInt(r.value) || Number(r.value) <= 0) {
        e.spellListRanks = `SpellListRanks[${i + 1}]: value must be positive`;
        break;
      }

      if (!r.options.length) {
        e.spellListRanks = `SpellListRanks[${i + 1}]: select at least one spell list`;
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
        e.spellListCategoryRankChoices =
          `SpellListCategoryRankChoices[${i + 1}]: value must be a positive integer`;
        break;
      }

      if (!isValidUnsignedInt(r.numChoices) || Number(r.numChoices) <= 0) {
        e.spellListCategoryRankChoices =
          `SpellListCategoryRankChoices[${i + 1}]: numChoices must be a positive integer`;
        break;
      }

      if (!r.options.length) {
        e.spellListCategoryRankChoices =
          `SpellListCategoryRankChoices[${i + 1}]: select at least one category`;
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
          `LifestyleCategorySkillChoices[${i + 1}]: numChoices must be a positive integer`;
        break;
      }

      if (!r.options.length) {
        e.lifestyleCategorySkillChoices =
          `LifestyleCategorySkillChoices[${i + 1}]: select at least one category`;
        break;
      }
    }

    /* -------------------------------------------------- */
    /* Language choices                                   */
    /* -------------------------------------------------- */

    for (let i = 0; i < draft.languageChoices.length; i++) {
      const r = draft.languageChoices[i];
      if (!r) continue;
      if (!isValidUnsignedInt(r.numChoices) || Number(r.numChoices) <= 0) {
        e.languageChoices = `LanguageChoices[${i + 1}]: numChoices must be positive`;
        break;
      }

      if (!isValidUnsignedInt(r.value) || Number(r.value) <= 0) {
        e.languageChoices = `LanguageChoices[${i + 1}]: value must be positive`;
        break;
      }

      if (!r.options.length) {
        e.languageChoices = `LanguageChoices[${i + 1}]: select at least one language`;
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

  const globalFilter = (r: TrainingPackage, q: string) =>
    [r.id, r.name, r.description ?? '']
      .some((v) => String(v).toLowerCase().includes(q.toLowerCase()));

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
    const nextErrors = computeErrors(form);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const payload = fromVM(form);
    const isEditing = Boolean(editingId);

    try {
      const opts = isEditing
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };

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
    }
  };

  const onDelete = async (row: TrainingPackage) => {
    const ok = await confirm({
      title: 'Delete Training Package',
      body: `Delete "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter((r) => r.id !== row.id));

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
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={startNew}>New Training Package</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search training packages…"
            aria-label="Search training packages"
          />

          {/* Reset and auto-fit column widths */}
          <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
          <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
        </div>
      )}

      {showForm && (
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
            />
            <LabeledSelect
              label="Book"
              value={form.book}
              onChange={(v) => setForm((s) => ({ ...s, book: v }))}
              options={bookOptions}
              disabled={viewing}
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
            />
            {/* Starting money modifier */}
            <LabeledInput
              label="Starting Money Modifier (dice notation, e.g. 2d6)"
              value={form.startingMoneyModifierDice}
              onChange={(v) => setForm((s) => ({ ...s, startingMoneyModifierDice: v }))}
              disabled={viewing}
            />
          </div>

          {/* Description */}
          <section style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h4 style={{ margin: '8px 0' }}>Description</h4>
              <button type="button" onClick={() => setPreviewDescription((p) => !p)}>
                {previewDescription ? 'Edit' : 'Preview'}
              </button>
            </div>
            {previewDescription ? (
              <HtmlPreview
                html={form.description}
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
              <button type="button" onClick={() => setPreviewFlavourText((p) => !p)}>
                {previewFlavourText ? 'Edit' : 'Preview'}
              </button>
            </div>
            {previewFlavourText ? (
              <HtmlPreview
                html={form.flavourText}
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
            <HtmlPreviewList title="Notes" arr={form.notes} viewing />
          ) : (
            <HtmlPreviewList title="Notes" arr={form.notes} viewing={false} error={errors.notes}
              onChangeNotes={(next) => setForm((s) => ({ ...s, notes: next }))}
            />
          )}

          {/* Races */}
          <IdListEditor
            title="Allowed Races"
            rows={form.races}
            onChangeRows={(next) => setForm((s) => ({ ...s, races: next }))}
            options={raceOptions}
            viewing={viewing}
          />

          {/* Qualifiers */}
          <TextNumberListEditor
            title="Qualifiers"
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
            rows={form.skillRanks}
            onChangeRows={(next) => setForm((s) => ({ ...s, skillRanks: next }))}
            idOptions={skillOptions}
            viewing={viewing}
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
            rows={form.categoryRanks}
            onChangeRows={(next) => setForm((s) => ({ ...s, categoryRanks: next }))}
            options={categoryOptions}
            loading={loading}
            viewing={viewing}
            error={errors.categoryRanks}
            signedValues
          />

          {/* Category Multi‑Skill Rank Choices */}
          <IdMultiSkillRankEditor
            title="Category Multi-Skill Rank Choices"
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
            categoryOptions={categoryOptions}
            viewing={viewing}
            error={errors.spellListCategoryRankChoices}
          />

          {/* Lifestyle Skills */}
          <SkillListEditor
            title="Lifestyle Skills"
            rows={form.lifestyleSkills}
            onChangeRows={(next) => setForm((s) => ({ ...s, lifestyleSkills: next }))}
            idOptions={skillOptions}
            viewing={viewing}
          />

          {/* Lifestyle Categories */}
          <IdListEditor
            title="Lifestyle Categories"
            rows={form.lifestyleCategories}
            onChangeRows={(next) => setForm((s) => ({ ...s, lifestyleCategories: next }))}
            options={categoryOptions}
            viewing={viewing}
          />

          {/* Lifestyle Groups */}
          <IdListEditor
            title="Lifestyle Groups"
            rows={form.lifestyleGroups}
            onChangeRows={(next) => setForm((s) => ({ ...s, lifestyleGroups: next }))}
            options={groupOptions}
            viewing={viewing}
          />

          {/* Lifestyle Category Skill Choices */}
          <ChoiceListEditor<string, string>
            title="Lifestyle Category Skill Choices"
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

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!viewing && (
              <button onClick={saveForm} disabled={hasErrors}>
                Save
              </button>
            )}
            <button onClick={cancelForm} type="button">
              {viewing ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <DataTable
          ref={dtRef}
          rows={rows}
          columns={columns}
          rowId={(r) => r.id}
          searchQuery={query}
          globalFilter={globalFilter}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </>
  );
}