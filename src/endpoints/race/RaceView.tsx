import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchBooks,
  fetchLanguages,
  fetchRaces, upsertRace, deleteRace,
  fetchSkills,
  fetchSkillCategories,
  fetchSkillGroups,
  fetchSkillProgressionTypes,
} from '../../api';


import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  CheckboxInput,
  ChoiceListEditor,
  IdListEditor,
  IdValueListEditor,
  LabeledInput,
  LabeledSelect,
  LanguageRankListEditor,
  MarkupPreview,
  SkillListEditor,
  SkillValueListEditor,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  Book,
  Language, LanguageAbility,
  Race, RaceSkillRef, RaceSkillCategoryChoice,
  Skill,
  SkillCategory,
  SkillGroup,
  SkillValue,
  SkillProgressionType,
} from '../../types';

import {
  CREATURE_SIZES, type CreatureSize,
  CRITICAL_TABLE_TYPES, type CriticalTableType,
  BASE_RESISTANCE_TYPES, type ResistanceType,
  STATS, type Stat,
} from '../../types/enum';


import {
  isValidID, makeIDOnChange,
  isValidSignedInt, makeSignedFloatOnChange,
  isValidUnsignedInt, makeUnsignedIntOnChange,
} from '../../utils';

const prefix = 'RACE_';

// ---------- VM row types ----------
type LanguageRankVM = {
  language: string;
  spoken?: string | undefined;
  written?: string | undefined;
  somatic?: string | undefined;
};

type SkillRefVM = {
  id: string;
  subcategory?: string | undefined;
};

type SkillBonusVM = {
  id: string;
  subcategory?: string | undefined;
  value: string;
};

type StatBonusVM = {
  id: Stat | '';
  value: string;
};

type ResistanceBonusVM = {
  id: ResistanceType | '';
  value: string;
};

type CategoryChoiceVM = {
  numChoices: string;
  options: string[];
};

type FormState = {
  id: string;
  name: string;
  description: string;

  book: string;

  highCulture: boolean;
  creatureSize: CreatureSize | '';
  criticalTable: CriticalTableType | '';

  recoveryMultiplier: string;
  backgroundOptions: string;
  exhaustionBonus: string;
  statLossRacialType: string;
  requiredSleep: string;
  requiredSleepFrequency: string;
  soulDeparture: string;
  buildModifier: string;
  averageMaleHeight: string;
  averageFemaleHeight: string;
  averageLifespan: string;
  maleWeightModifier: string;
  femaleWeightModifier: string;

  arcaneProgression: string;
  armsProgression: string;
  channelingProgression: string;
  essenceProgression: string;
  mentalismProgression: string;

  startingLanguages: LanguageRankVM[];
  adolescentLanguages: LanguageRankVM[];

  statBonuses: StatBonusVM[];
  resistanceBonuses: ResistanceBonusVM[];

  everymanSkills: SkillRefVM[];
  restrictedSkills: SkillRefVM[];

  everymanCategories: string[];
  restrictedCategories: string[];

  skillBonuses: SkillBonusVM[];

  skillCategoryChoicesEveryman: CategoryChoiceVM[];
};

type FormErrors = {
  id?: string;
  name?: string;
  book?: string;
  creatureSize?: string;
  criticalTable?: string;
  recoveryMultiplier?: string;
  backgroundOptions?: string;
  exhaustionBonus?: string;
  statLossRacialType?: string;
  requiredSleep?: string;
  requiredSleepFrequency?: string;
  soulDeparture?: string;
  buildModifier?: string;
  averageMaleHeight?: string;
  averageFemaleHeight?: string;
  averageLifespan?: string;
  maleWeightModifier?: string;
  femaleWeightModifier?: string;
  arcaneProgression?: string;
  armsProgression?: string;
  channelingProgression?: string;
  essenceProgression?: string;
  mentalismProgression?: string;
  startingLanguages?: string;
  adolescentLanguages?: string;
  statBonuses?: string;
  resistanceBonuses?: string;
  everymanSkills?: string;
  restrictedSkills?: string;
  skillBonuses?: string;
  skillCategoryChoicesEveryman?: string;
};

const emptyVM = (): FormState => ({
  id: prefix,
  name: '',
  description: '',

  book: '',

  highCulture: false,
  creatureSize: '',
  criticalTable: '',

  recoveryMultiplier: '',
  backgroundOptions: '',
  exhaustionBonus: '',
  statLossRacialType: '',
  requiredSleep: '',
  requiredSleepFrequency: '',
  soulDeparture: '',
  buildModifier: '',
  averageMaleHeight: '',
  averageFemaleHeight: '',
  averageLifespan: '',
  maleWeightModifier: '',
  femaleWeightModifier: '',

  arcaneProgression: '',
  armsProgression: '',
  channelingProgression: '',
  essenceProgression: '',
  mentalismProgression: '',

  startingLanguages: [],
  adolescentLanguages: [],

  statBonuses: [],
  resistanceBonuses: [],
  everymanSkills: [],
  restrictedSkills: [],

  everymanCategories: [],
  restrictedCategories: [],

  skillBonuses: [],

  skillCategoryChoicesEveryman: [],
});

const toVM = (x: Race): FormState => ({
  id: x.id,
  name: x.name,
  description: x.description ?? '',

  book: x.book,

  highCulture: x.highCulture,
  creatureSize: x.creatureSize ?? '',
  criticalTable: x.criticalTable ?? '',

  recoveryMultiplier: String(x.recoveryMultiplier),
  backgroundOptions: String(x.backgroundOptions),
  exhaustionBonus: String(x.exhaustionBonus),
  statLossRacialType: String(x.statLossRacialType),
  requiredSleep: String(x.requiredSleep),
  requiredSleepFrequency: String(x.requiredSleepFrequency),
  soulDeparture: String(x.soulDeparture),
  buildModifier: String(x.buildModifier),
  averageMaleHeight: String(x.averageMaleHeight),
  averageFemaleHeight: String(x.averageFemaleHeight),
  averageLifespan: String(x.averageLifespan),
  maleWeightModifier: String(x.maleWeightModifier),
  femaleWeightModifier: String(x.femaleWeightModifier),

  arcaneProgression: x.arcaneProgression,
  armsProgression: x.armsProgression,
  channelingProgression: x.channelingProgression,
  essenceProgression: x.essenceProgression,
  mentalismProgression: x.mentalismProgression,

  startingLanguages: (x.startingLanguages ?? []).map((r) => ({
    language: r.language,
    spoken: r.spoken != null ? String(r.spoken) : undefined,
    written: r.written != null ? String(r.written) : undefined,
    somatic: r.somatic != null ? String(r.somatic) : undefined,
  })),
  adolescentLanguages: (x.adolescentLanguages ?? []).map((r) => ({
    language: r.language,
    spoken: r.spoken != null ? String(r.spoken) : undefined,
    written: r.written != null ? String(r.written) : undefined,
    somatic: r.somatic != null ? String(r.somatic) : undefined,
  })),

  statBonuses: (x.statBonuses ?? []).map((r) => ({
    id: r.id,
    value: String(r.value),
  })),

  resistanceBonuses: (x.resistanceBonuses ?? []).map((r) => ({
    id: r.id,
    value: String(r.value),
  })),

  everymanSkills: (x.everymanSkills ?? []).map((r) => ({
    id: r.id,
    subcategory: r.subcategory,
  })),
  restrictedSkills: (x.restrictedSkills ?? []).map((r) => ({
    id: r.id,
    subcategory: r.subcategory,
  })),

  everymanCategories: x.everymanCategories ?? [],
  restrictedCategories: x.restrictedCategories ?? [],

  skillBonuses: (x.skillBonuses ?? []).map((r) => ({
    id: r.id,
    subcategory: r.subcategory,
    value: String(r.value),
  })),

  skillCategoryChoicesEveryman: (x.skillCategoryChoicesEveryman ?? []).map((r) => ({
    numChoices: String(r.numChoices),
    options: r.options.slice(),
  })),
});

const fromVM = (vm: FormState): Race => ({
  id: vm.id.trim(),
  name: vm.name.trim(),
  description: vm.description.trim() || undefined,

  book: vm.book.trim(),

  highCulture: !!vm.highCulture,
  creatureSize: vm.creatureSize as CreatureSize,
  criticalTable: vm.criticalTable as CriticalTableType,

  recoveryMultiplier: Number(vm.recoveryMultiplier),
  backgroundOptions: Number(vm.backgroundOptions),
  exhaustionBonus: Number(vm.exhaustionBonus),
  statLossRacialType: Number(vm.statLossRacialType),
  requiredSleep: Number(vm.requiredSleep),
  requiredSleepFrequency: Number(vm.requiredSleepFrequency),
  soulDeparture: Number(vm.soulDeparture),
  buildModifier: Number(vm.buildModifier),
  averageMaleHeight: Number(vm.averageMaleHeight),
  averageFemaleHeight: Number(vm.averageFemaleHeight),
  averageLifespan: Number(vm.averageLifespan),
  maleWeightModifier: Number(vm.maleWeightModifier),
  femaleWeightModifier: Number(vm.femaleWeightModifier),

  arcaneProgression: vm.arcaneProgression.trim(),
  armsProgression: vm.armsProgression.trim(),
  channelingProgression: vm.channelingProgression.trim(),
  essenceProgression: vm.essenceProgression.trim(),
  mentalismProgression: vm.mentalismProgression.trim(),

  startingLanguages: vm.startingLanguages.map((r): LanguageAbility => ({
    language: r.language,
    spoken: r.spoken?.trim() ? Number(r.spoken) : undefined,
    written: r.written?.trim() ? Number(r.written) : undefined,
    somatic: r.somatic?.trim() ? Number(r.somatic) : undefined,
  })),

  adolescentLanguages: vm.adolescentLanguages.map((r): LanguageAbility => ({
    language: r.language,
    spoken: r.spoken?.trim() ? Number(r.spoken) : undefined,
    written: r.written?.trim() ? Number(r.written) : undefined,
    somatic: r.somatic?.trim() ? Number(r.somatic) : undefined,
  })),

  statBonuses: vm.statBonuses.map((r) => ({
    id: r.id as Stat,
    value: Number(r.value),
  })),

  resistanceBonuses: vm.resistanceBonuses.map((r) => ({
    id: r.id as ResistanceType,
    value: Number(r.value),
  })),

  everymanSkills: vm.everymanSkills.map((r): RaceSkillRef => ({
    id: r.id,
    subcategory: r.subcategory?.trim() || undefined,
  })),

  restrictedSkills: vm.restrictedSkills.map((r): RaceSkillRef => ({
    id: r.id,
    subcategory: r.subcategory?.trim() || undefined,
  })),

  everymanCategories: vm.everymanCategories.slice(),
  restrictedCategories: vm.restrictedCategories.slice(),

  skillBonuses: vm.skillBonuses.map((r): SkillValue => ({
    id: r.id,
    subcategory: r.subcategory?.trim() || undefined,
    value: Number(r.value),
  })),

  skillCategoryChoicesEveryman: vm.skillCategoryChoicesEveryman.map((r): RaceSkillCategoryChoice => ({
    numChoices: Number(r.numChoices),
    options: r.options.slice(),
  })),
});

export default function RaceView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  const [books, setBooks] = useState<Book[]>([]);
  const [progressions, setProgressions] = useState<SkillProgressionType[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [groups, setGroups] = useState<SkillGroup[]>([]);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());

  const [previewDescription, setPreviewDescription] = useState(false);

  const toast = useToast();
  const confirm = useConfirm();

  /* ------------------------------------------------------------------ */
  /* Load data                                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    (async () => {
      try {
        const [r, b, sp, l, s, c, g] = await Promise.all([
          fetchRaces(),
          fetchBooks(),
          fetchSkillProgressionTypes(),
          fetchLanguages(),
          fetchSkills(),
          fetchSkillCategories(),
          fetchSkillGroups(),
        ]);
        setRows(r);
        setBooks(b);
        setProgressions(sp);
        setLanguages(l);
        setSkills(s);
        setCategories(c);
        setGroups(g);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
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

  const progressionOptions = useMemo(
    () => {
      const sorted = [...progressions].sort((a, b) =>
        a.zero - b.zero
        || a.ten - b.ten
        || a.twenty - b.twenty
        || a.thirty - b.thirty
        || a.remaining - b.remaining
        || a.name.localeCompare(b.name)
      );

      return sorted.map((p) => ({
        value: p.id,
        label: `[${p.zero} : ${p.ten} : ${p.twenty} : ${p.thirty} : ${p.remaining}] - ${p.name}`,
      }));
    },
    [progressions],
  );

  const progressionOptionsByPrefix = useMemo(() => {
    const byPrefix = {
      arms: progressionOptions.filter((option) => option.value.startsWith('SKILLPROGRESSIONTYPE_BD_')),
      spell: progressionOptions.filter((option) => option.value.startsWith('SKILLPROGRESSIONTYPE_PP_')),
    };

    return byPrefix;
  }, [progressionOptions]);

  const languageOptions = useMemo(
    () => languages.map((l) => ({ value: l.id, label: l.name })),
    [languages],
  );

  const skillOptions = useMemo(
    () => skills.map((s) => ({ value: s.id, label: s.name })),
    [skills],
  );

  const sgNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const sg of groups) m.set(sg.id, sg.name);
    return m;
  }, [groups]);

  const categoryOptions = useMemo(
    () => categories.map(c => ({ value: c.id, label: `(${sgNameById.get(c.group) ?? c.group}) - ${c.name}` })),
    [categories, sgNameById],
  );

  const creatureSizeOptions = useMemo(
    () => CREATURE_SIZES.map((v) => ({ value: v, label: v })),
    [],
  );

  const criticalTableOptions = useMemo(
    () => CRITICAL_TABLE_TYPES.map((v) => ({ value: v, label: v })),
    [],
  );

  const statOptions = useMemo(
    () => STATS.map((v) => ({ value: v, label: v })),
    [],
  );

  const resistanceOptions = useMemo(
    () => BASE_RESISTANCE_TYPES.map((v) => ({ value: v, label: v })),
    [],
  );

  /* ------------------------------------------------------------------ */
  /* Validation                                                         */
  /* ------------------------------------------------------------------ */
  const computeErrors = (draft: FormState): FormErrors => {
    const e: FormErrors = {};
    const validateLanguageRankRow = (
      row: LanguageRankVM,
      fieldLabel: string,
      rowNumber: number,
    ): string | undefined => {
      if (!row.language) return `${fieldLabel}[${rowNumber}]: language required`;

      const hasSpoken = !!row.spoken?.trim();
      const hasWritten = !!row.written?.trim();
      const hasSomatic = !!row.somatic?.trim();

      if (!hasSpoken && !hasWritten && !hasSomatic) {
        return `${fieldLabel}[${rowNumber}]: at least one of spoken/written/somatic is required`;
      }

      if (
        (hasSpoken && !isValidUnsignedInt(row.spoken!))
        || (hasWritten && !isValidUnsignedInt(row.written!))
        || (hasSomatic && !isValidUnsignedInt(row.somatic!))
      ) {
        return `${fieldLabel}[${rowNumber}]: rank values must be unsigned integers`;
      }

      return undefined;
    };

    const id = draft.id.trim();
    const nm = draft.name.trim();

    if (!id) e.id = 'ID is required';
    else if (!editingId && rows.some((r) => r.id === id)) e.id = `ID "${id}" already exists`;
    else if (!isValidID(id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;

    if (!nm) e.name = 'Name is required';
    if (!draft.book) e.book = 'Book is required';
    if (!draft.creatureSize) e.creatureSize = 'Creature size is required';
    if (!draft.criticalTable) e.criticalTable = 'Critical table is required';

    if (!draft.recoveryMultiplier) e.recoveryMultiplier = 'Recovery multiplier is required';
    if (!draft.backgroundOptions) e.backgroundOptions = 'Background options is required';
    if (!draft.exhaustionBonus) e.exhaustionBonus = 'Exhaustion bonus is required';
    if (!draft.statLossRacialType) e.statLossRacialType = 'Stat loss racial type is required';
    if (!draft.requiredSleep) e.requiredSleep = 'Required sleep is required';
    if (!draft.requiredSleepFrequency) e.requiredSleepFrequency = 'Required sleep frequency is required';
    if (!draft.soulDeparture) e.soulDeparture = 'Soul departure is required';
    if (!draft.buildModifier) e.buildModifier = 'Build modifier is required';
    if (!draft.averageMaleHeight) e.averageMaleHeight = 'Average male height is required';
    if (!draft.averageFemaleHeight) e.averageFemaleHeight = 'Average female height is required';
    if (!draft.averageLifespan) e.averageLifespan = 'Average lifespan is required';
    if (!draft.maleWeightModifier) e.maleWeightModifier = 'Male weight modifier is required';
    if (!draft.femaleWeightModifier) e.femaleWeightModifier = 'Female weight modifier is required';

    if (!draft.arcaneProgression) e.arcaneProgression = 'Arcane progression is required';
    else if (!progressionOptionsByPrefix.spell.some((option) => option.value === draft.arcaneProgression)) e.arcaneProgression = 'Arcane progression must use a spell progression value';
    if (!draft.armsProgression) e.armsProgression = 'Arms progression is required';
    else if (!progressionOptionsByPrefix.arms.some((option) => option.value === draft.armsProgression)) e.armsProgression = 'Arms progression must use an Arms progression value';
    if (!draft.channelingProgression) e.channelingProgression = 'Channeling progression is required';
    else if (!progressionOptionsByPrefix.spell.some((option) => option.value === draft.channelingProgression)) e.channelingProgression = 'Channeling progression must use a spell progression value';
    if (!draft.essenceProgression) e.essenceProgression = 'Essence progression is required';
    else if (!progressionOptionsByPrefix.spell.some((option) => option.value === draft.essenceProgression)) e.essenceProgression = 'Essence progression must use a spell progression value';
    if (!draft.mentalismProgression) e.mentalismProgression = 'Mentalism progression is required';
    else if (!progressionOptionsByPrefix.spell.some((option) => option.value === draft.mentalismProgression)) e.mentalismProgression = 'Mentalism progression must use a spell progression value';

    for (let i = 0; i < draft.startingLanguages.length; i++) {
      const r = draft.startingLanguages[i];
      if (!r) continue
      const languageError = validateLanguageRankRow(r, 'StartingLanguages', i + 1);
      if (languageError) { e.startingLanguages = languageError; break; }
    }

    for (let i = 0; i < draft.adolescentLanguages.length; i++) {
      const r = draft.adolescentLanguages[i];
      if (!r) continue
      const languageError = validateLanguageRankRow(r, 'AdolescentLanguages', i + 1);
      if (languageError) { e.adolescentLanguages = languageError; break; }
    }

    for (let i = 0; i < draft.statBonuses.length; i++) {
      const r = draft.statBonuses[i];
      if (!r) continue
      if (!r.id) { e.statBonuses = `StatBonuses[${i + 1}]: stat required`; break; }
      if (!isValidSignedInt(r.value)) { e.statBonuses = `StatBonuses[${i + 1}]: value must be integer`; break; }
    }

    for (let i = 0; i < draft.everymanSkills.length; i++) {
      const r = draft.everymanSkills[i];
      if (!r) continue
      if (!r.id) { e.everymanSkills = `EverymanSkills[${i + 1}]: skill required`; break; }
    }

    for (let i = 0; i < draft.restrictedSkills.length; i++) {
      const r = draft.restrictedSkills[i];
      if (!r) continue
      if (!r.id) { e.restrictedSkills = `RestrictedSkills[${i + 1}]: skill required`; break; }
    }

    for (let i = 0; i < draft.skillBonuses.length; i++) {
      const r = draft.skillBonuses[i];
      if (!r) continue
      if (!r.id) { e.skillBonuses = `SkillBonuses[${i + 1}]: skill required`; break; }
      if (!isValidSignedInt(r.value)) { e.skillBonuses = `SkillBonuses[${i + 1}]: value must be integer`; break; }
    }

    for (let i = 0; i < draft.skillCategoryChoicesEveryman.length; i++) {
      const r = draft.skillCategoryChoicesEveryman[i];
      if (!r) continue
      if (!isValidUnsignedInt(r.numChoices) || Number(r.numChoices) <= 0) {
        e.skillCategoryChoicesEveryman = `SkillCategoryChoicesEveryman[${i + 1}]: numChoices must be positive integer`;
        break;
      }
      if (!r.options.length || r.options.some((o) => !o)) {
        e.skillCategoryChoicesEveryman = `SkillCategoryChoicesEveryman[${i + 1}]: choose at least one category`;
        break;
      }
    }

    return e;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing, progressionOptionsByPrefix]);

  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */
  const columns: ColumnDef<Race>[] = useMemo(() => [
    { id: 'id', header: 'ID', accessor: (r) => r.id, sortType: 'string', minWidth: 260 },
    { id: 'name', header: 'Name', accessor: (r) => r.name, sortType: 'string', minWidth: 180 },
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
    { id: 'size', header: 'Size', accessor: (r) => r.creatureSize, sortType: 'string', minWidth: 120 },
    { id: 'criticalTable', header: 'Critical Table', accessor: (r) => r.criticalTable, sortType: 'string', minWidth: 140 },
    {
      id: 'actions',
      header: 'Actions',
      sortable: false,
      width: 420,
      render: (row) => (
        <>
          <button onClick={() => startView(row)} style={{ marginRight: 6 }}>View</button>
          <button onClick={() => startEdit(row)} style={{ marginRight: 6 }}>Edit</button>
          <button onClick={() => startDuplicate(row)} style={{ marginRight: 6 }}>Duplicate</button>
          <button onClick={() => onDelete(row)} style={{ color: '#b00020' }}>Delete</button>
        </>
      ),
    },
  ], [bookNameById]);

  const globalFilter = (r: Race, q: string) => {
    const s = q.toLowerCase();
    return [
      r.id, r.name, r.description ?? '', r.book, r.creatureSize, r.criticalTable,
    ].some((v) => String(v ?? '').toLowerCase().includes(s));
  };


  /* ------------------------------------------------------------------ */
  /* Actions                                                            */
  /* ------------------------------------------------------------------ */
  const startNew = () => {
    setViewing(false);
    setEditingId(null);
    setForm(emptyVM());
    setErrors({});
    setShowForm(true);
  };

  const startView = (row: Race) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: Race) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: Race) => {
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
    setViewing(false);
    setEditingId(null);
    setErrors({});
    setShowForm(false);
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

      await upsertRace(payload, opts);

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
        description: `Race "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: Race) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Race',
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
      await deleteRace(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Race "${row.id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err), });
    } finally {
      setSubmitting(false);
    }
  };


  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */
  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Races</h2>

      {/* Toolbar hidden while form visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={startNew}>New Race</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search races…"
            aria-label="Search races"
          />

          {/* Reset and auto-fit column widths */}
          <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
          <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
        </div>
      )}

      {/* Display main Form */}
      {showForm && (
        <div className="form-container">
          {/* Simple overlay while submitting */}
          {submitting && (<div className="overlay"><Spinner size={24} /> <span>Saving…</span> </div>)}

          <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`}>
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Race</h3>

            {/* Basic */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
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
                disabled={loading || viewing}
                error={viewing ? undefined : errors.book}
              />

              <CheckboxInput
                label="High Culture"
                checked={form.highCulture}
                onChange={(c) => setForm((s) => ({ ...s, highCulture: c }))}
                disabled={viewing}
              />

              <LabeledSelect
                label="Creature Size"
                value={form.creatureSize}
                onChange={(v) => setForm((s) => ({ ...s, creatureSize: v as CreatureSize }))}
                options={creatureSizeOptions}
                disabled={viewing}
                error={viewing ? undefined : errors.creatureSize}
              />

              <LabeledSelect
                label="Critical Table"
                value={form.criticalTable}
                onChange={(v) => setForm((s) => ({ ...s, criticalTable: v as CriticalTableType }))}
                options={criticalTableOptions}
                disabled={viewing}
                error={viewing ? undefined : errors.criticalTable}
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

            {/* Numbers */}
            <section style={{ marginTop: 12 }}>
              <h4 style={{ margin: '8px 0' }}>Values</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <LabeledInput label="Recovery Multiplier" tooltip="Multiplier to injury recovery rate" value={form.recoveryMultiplier} onChange={makeSignedFloatOnChange<typeof form>('recoveryMultiplier', setForm)} disabled={viewing} error={errors.recoveryMultiplier} />
                <LabeledInput label="Background Options" tooltip="Number of background options available" value={form.backgroundOptions} onChange={makeUnsignedIntOnChange<typeof form>('backgroundOptions', setForm)} disabled={viewing} error={errors.backgroundOptions} />
                <LabeledInput label="Exhaustion Bonus" tooltip="Extra exhaustion points" value={form.exhaustionBonus} onChange={makeUnsignedIntOnChange<typeof form>('exhaustionBonus', setForm)} disabled={viewing} error={errors.exhaustionBonus} />
                <LabeledInput label="Stat Loss Racial Type" tooltip="1 - 5; high is quicker stat loss" value={form.statLossRacialType} onChange={makeUnsignedIntOnChange<typeof form>('statLossRacialType', setForm)} disabled={viewing} error={errors.statLossRacialType} />
                <LabeledInput label="Required Sleep" tooltip="Hours of sleep required (hrs)" value={form.requiredSleep} onChange={makeUnsignedIntOnChange<typeof form>('requiredSleep', setForm)} disabled={viewing} error={errors.requiredSleep} />
                <LabeledInput label="Required Sleep Frequency" tooltip="Frequency of required sleep (days)" value={form.requiredSleepFrequency} onChange={makeUnsignedIntOnChange<typeof form>('requiredSleepFrequency', setForm)} disabled={viewing} error={errors.requiredSleepFrequency} />
                <LabeledInput label="Soul Departure" tooltip="Rounds after death until soul departure" value={form.soulDeparture} onChange={makeUnsignedIntOnChange<typeof form>('soulDeparture', setForm)} disabled={viewing} error={errors.soulDeparture} />
                <LabeledInput label="Build Modifier" tooltip="Variance from human build (typically -2 to 2)" value={form.buildModifier} onChange={makeUnsignedIntOnChange<typeof form>('buildModifier', setForm)} disabled={viewing} error={errors.buildModifier} />
                <LabeledInput label="Average Male Height" tooltip="Average height for males (in)" value={form.averageMaleHeight} onChange={makeUnsignedIntOnChange<typeof form>('averageMaleHeight', setForm)} disabled={viewing} error={errors.averageMaleHeight} />
                <LabeledInput label="Average Female Height" tooltip="Average height for females (in)" value={form.averageFemaleHeight} onChange={makeUnsignedIntOnChange<typeof form>('averageFemaleHeight', setForm)} disabled={viewing} error={errors.averageFemaleHeight} />
                <LabeledInput label="Average Lifespan" tooltip="Average lifespan (years)" value={form.averageLifespan} onChange={makeUnsignedIntOnChange<typeof form>('averageLifespan', setForm)} disabled={viewing} error={errors.averageLifespan} />
                <LabeledInput label="Male Weight Modifier" tooltip="Frame modifier: 1 is average" value={form.maleWeightModifier} onChange={makeUnsignedIntOnChange<typeof form>('maleWeightModifier', setForm)} disabled={viewing} error={errors.maleWeightModifier} />
                <LabeledInput label="Female Weight Modifier" tooltip="Frame modifier: 1 is average" value={form.femaleWeightModifier} onChange={makeUnsignedIntOnChange<typeof form>('femaleWeightModifier', setForm)} disabled={viewing} error={errors.femaleWeightModifier} />
              </div>
            </section>

            {/* Progressions */}
            <section style={{ marginTop: 12 }}>
              <h4 style={{ margin: '8px 0' }}>Progressions</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <LabeledSelect label="Arcane" value={form.arcaneProgression} onChange={(v) => setForm((s) => ({ ...s, arcaneProgression: v }))} options={progressionOptionsByPrefix.spell} disabled={loading || viewing} error={viewing ? undefined : errors.arcaneProgression} />
                <LabeledSelect label="Arms" value={form.armsProgression} onChange={(v) => setForm((s) => ({ ...s, armsProgression: v }))} options={progressionOptionsByPrefix.arms} disabled={loading || viewing} error={viewing ? undefined : errors.armsProgression} />
                <LabeledSelect label="Channeling" value={form.channelingProgression} onChange={(v) => setForm((s) => ({ ...s, channelingProgression: v }))} options={progressionOptionsByPrefix.spell} disabled={loading || viewing} error={viewing ? undefined : errors.channelingProgression} />
                <LabeledSelect label="Essence" value={form.essenceProgression} onChange={(v) => setForm((s) => ({ ...s, essenceProgression: v }))} options={progressionOptionsByPrefix.spell} disabled={loading || viewing} error={viewing ? undefined : errors.essenceProgression} />
                <LabeledSelect label="Mentalism" value={form.mentalismProgression} onChange={(v) => setForm((s) => ({ ...s, mentalismProgression: v }))} options={progressionOptionsByPrefix.spell} disabled={loading || viewing} error={viewing ? undefined : errors.mentalismProgression} />
              </div>
            </section>

            {/* Language editors */}
            <LanguageRankListEditor
              title="Starting Languages"
              rows={form.startingLanguages}
              onChangeRows={(next) =>
                setForm((s) => ({ ...s, startingLanguages: next }))
              }
              languageOptions={languageOptions}
              loading={loading}
              viewing={viewing}
              error={errors.startingLanguages}
              showSomatic
            />

            <LanguageRankListEditor
              title="Adolescent Languages"
              rows={form.adolescentLanguages}
              onChangeRows={(next) =>
                setForm((s) => ({ ...s, adolescentLanguages: next }))
              }
              languageOptions={languageOptions}
              loading={loading}
              viewing={viewing}
              error={errors.adolescentLanguages}
              showSomatic
            />


            {/* Stat bonuses */}
            <IdValueListEditor
              title="Stat Bonuses"
              addButtonLabel='+ Add stat bonus'
              rows={form.statBonuses}
              onChangeRows={(next) => setForm((s) => ({ ...s, statBonuses: next }))}
              options={statOptions}
              viewing={viewing}
              error={errors.statBonuses}
              signedValues
            />

            {/* Resistance bonuses */}
            <IdValueListEditor
              title="Resistance Bonuses"
              addButtonLabel='+ Add resistance bonus'
              rows={form.resistanceBonuses}
              onChangeRows={(next) => setForm((s) => ({ ...s, resistanceBonuses: next }))}
              options={resistanceOptions}
              viewing={viewing}
              error={errors.resistanceBonuses}
              signedValues
            />

            {/* Everyman skills */}
            <SkillListEditor
              title="Everyman Skills"
              addButtonLabel='+ Add everyman skill'
              rows={form.everymanSkills}
              onChangeRows={(next) => setForm((s) => ({ ...s, everymanSkills: next }))}
              idOptions={skillOptions}
              loading={loading}
              viewing={viewing}
              error={errors.everymanSkills}
            />

            {/* Restricted skills */}
            <SkillListEditor
              title="Restricted Skills"
              addButtonLabel='+ Add restricted skill'
              rows={form.restrictedSkills}
              onChangeRows={(next) => setForm((s) => ({ ...s, restrictedSkills: next }))}
              idOptions={skillOptions}
              loading={loading}
              viewing={viewing}
              error={errors.restrictedSkills}
            />

            {/* Everyman categories */}
            <IdListEditor
              title="Everyman Categories"
              addButtonLabel='+ Add everyman category'
              rows={form.everymanCategories}
              onChangeRows={(next) => setForm((s) => ({ ...s, everymanCategories: next }))}
              options={categoryOptions}
              loading={loading}
              viewing={viewing}
              columnLabel="Category"
            />

            {/* Restricted categories */}
            <IdListEditor
              title="Restricted Categories"
              addButtonLabel='+ Add restricted category'
              rows={form.restrictedCategories}
              onChangeRows={(next) => setForm((s) => ({ ...s, restrictedCategories: next }))}
              options={categoryOptions}
              loading={loading}
              viewing={viewing}
              columnLabel="Category"
            />

            {/* Skill bonuses */}
            <SkillValueListEditor
              title="Skill Bonuses"
              addButtonLabel='+ Add skill bonus'
              rows={form.skillBonuses}
              onChangeRows={(next) => setForm((s) => ({ ...s, skillBonuses: next }))}
              idOptions={skillOptions}
              loading={loading}
              viewing={viewing}
              error={errors.skillBonuses}
              signedValues
            />

            {/* Skill Category Choices Everyman */}
            <ChoiceListEditor<string, string>
              title="Skill Category Choices (Everyman)"
              addRowButtonLabel='+ Add skill category choice'
              rows={form.skillCategoryChoicesEveryman.map((r) => ({
                numChoices: r.numChoices,
                type: '' as string,
                options: r.options,
              }))}
              onChangeRows={(next) =>
                setForm((s) => ({
                  ...s,
                  skillCategoryChoicesEveryman: next.map((r) => ({
                    numChoices: r.numChoices,
                    options: r.options,
                  })),
                }))
              }
              typeOptions={[]}
              viewing={viewing}
              error={errors.skillCategoryChoicesEveryman}
              createEmptyOption={() => ''}
              createEmptyRow={() => ({
                numChoices: '',
                type: '',
                options: [],
              })}
              typeLabel="Unused"
              optionSectionLabel="Categories"
              renderOptionEditor={({ option, setOption, removeOption, viewing }) => (
                <div style={{ display: 'grid', gridTemplateColumns: viewing ? '1fr' : '1fr auto', gap: 8 }}>
                  <LabeledSelect
                    label="Category"
                    hideLabel
                    ariaLabel="Category"
                    value={option}
                    onChange={(v) => setOption(v)}
                    options={categoryOptions}
                    disabled={loading || viewing}
                  />
                  {!viewing && (
                    <button type="button" onClick={removeOption} style={{ color: '#b00020' }}>
                      Remove
                    </button>
                  )}
                </div>
              )}
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
          rows={rows}
          columns={columns}
          rowId={(r) => r.id}
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
          persistKey="dt.race.v1"
          ariaLabel="Races"
        />
      )}
    </>
  );
}