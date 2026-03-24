import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchBooks,
  fetchLanguages,
  fetchRaces, upsertRace, deleteRace,
  fetchSkills,
  fetchSkillcategories,
  fetchSkillprogressiontypes,
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
  useConfirm, useToast,
} from '../../components';

import type {
  Book,
  Language, LanguageRank,
  Race, RaceSkillRef, RaceSkillBonus, RaceSkillCategoryChoice,
  Skill,
  SkillCategory,
  SkillProgressionType,
} from '../../types';

import {
  CREATURE_SIZES, type CreatureSize,
  CRITICAL_TABLE_TYPES, type CriticalTableType,
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
  spoken: string;
  written: string;
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

  everymanSkills: SkillRefVM[];
  restrictedSkills: SkillRefVM[];

  everymanCategories: string[];
  restrictedCategories: string[];

  skillBonuses: SkillBonusVM[];

  skillCategoryChoicesEveryman: CategoryChoiceVM[];
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
    spoken: String(r.spoken),
    written: String(r.written),
    somatic: r.somatic != null ? String(r.somatic) : '',
  })),
  adolescentLanguages: (x.adolescentLanguages ?? []).map((r) => ({
    language: r.language,
    spoken: String(r.spoken),
    written: String(r.written),
    somatic: r.somatic != null ? String(r.somatic) : '',
  })),

  statBonuses: (x.statBonuses ?? []).map((r) => ({
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

  startingLanguages: vm.startingLanguages.map((r): LanguageRank => ({
    language: r.language,
    spoken: Number(r.spoken),
    written: Number(r.written),
    somatic: r.somatic?.trim() ? Number(r.somatic) : undefined,
  })),

  adolescentLanguages: vm.adolescentLanguages.map((r): LanguageRank => ({
    language: r.language,
    spoken: Number(r.spoken),
    written: Number(r.written),
    somatic: r.somatic?.trim() ? Number(r.somatic) : undefined,
  })),

  statBonuses: vm.statBonuses.map((r) => ({
    id: r.id as Stat,
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

  skillBonuses: vm.skillBonuses.map((r): RaceSkillBonus => ({
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

  const [books, setBooks] = useState<Book[]>([]);
  const [progressions, setProgressions] = useState<SkillProgressionType[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);

  const [booksLoading, setBooksLoading] = useState(true);
  const [progressionsLoading, setProgressionsLoading] = useState(true);
  const [languagesLoading, setLanguagesLoading] = useState(true);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());

  const [errors, setErrors] = useState<{
    id?: string | undefined;
    name?: string | undefined;
    book?: string | undefined;
    creatureSize?: string | undefined;
    criticalTable?: string | undefined;
    arcaneProgression?: string | undefined;
    armsProgression?: string | undefined;
    channelingProgression?: string | undefined;
    essenceProgression?: string | undefined;
    mentalismProgression?: string | undefined;
    startingLanguages?: string | undefined;
    adolescentLanguages?: string | undefined;
    statBonuses?: string | undefined;
    everymanSkills?: string | undefined;
    restrictedSkills?: string | undefined;
    skillBonuses?: string | undefined;
    skillCategoryChoicesEveryman?: string | undefined;
  }>({});

  const [previewDescription, setPreviewDescription] = useState(false);

  const toast = useToast();
  const confirm = useConfirm();

  // ---------- load main ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchRaces();
        if (!mounted) return;
        setRows(list);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ---------- load refs ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try { const list = await fetchBooks(); if (mounted) setBooks(list); }
      finally { if (mounted) setBooksLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try { const list = await fetchSkillprogressiontypes(); if (mounted) setProgressions(list); }
      finally { if (mounted) setProgressionsLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try { const list = await fetchLanguages(); if (mounted) setLanguages(list); }
      finally { if (mounted) setLanguagesLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try { const list = await fetchSkills(); if (mounted) setSkills(list); }
      finally { if (mounted) setSkillsLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try { const list = await fetchSkillcategories(); if (mounted) setCategories(list); }
      finally { if (mounted) setCategoriesLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  // ---------- options ----------
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
    () => progressions.map((p) => ({ value: p.id, label: p.name })),
    [progressions],
  );

  const languageOptions = useMemo(
    () => languages.map((l) => ({ value: l.id, label: l.name })),
    [languages],
  );

  const skillOptions = useMemo(
    () => skills.map((s) => ({ value: s.id, label: s.name })),
    [skills],
  );

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
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

  // ---------- validation ----------
  const computeErrors = (draft = form) => {
    const e: typeof errors = {};

    const id = draft.id.trim();
    const nm = draft.name.trim();

    if (!id) e.id = 'ID is required';
    else if (!editingId && rows.some((r) => r.id === id)) e.id = `ID "${id}" already exists`;
    else if (!isValidID(id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;

    if (!nm) e.name = 'Name is required';
    if (!draft.book) e.book = 'Book is required';
    if (!draft.creatureSize) e.creatureSize = 'Creature size is required';
    if (!draft.criticalTable) e.criticalTable = 'Critical table is required';

    if (!draft.arcaneProgression) e.arcaneProgression = 'Arcane progression is required';
    if (!draft.armsProgression) e.armsProgression = 'Arms progression is required';
    if (!draft.channelingProgression) e.channelingProgression = 'Channeling progression is required';
    if (!draft.essenceProgression) e.essenceProgression = 'Essence progression is required';
    if (!draft.mentalismProgression) e.mentalismProgression = 'Mentalism progression is required';

    for (let i = 0; i < draft.startingLanguages.length; i++) {
      const r = draft.startingLanguages[i];
      if (!r) continue
      if (!r.language) { e.startingLanguages = `StartingLanguages[${i + 1}]: language required`; break; }
      if (!isValidUnsignedInt(r.spoken) || !isValidUnsignedInt(r.written)) {
        e.startingLanguages = `StartingLanguages[${i + 1}]: spoken/written must be integers`; break;
      }
    }

    for (let i = 0; i < draft.adolescentLanguages.length; i++) {
      const r = draft.adolescentLanguages[i];
      if (!r) continue
      if (!r.language) { e.adolescentLanguages = `AdolescentLanguages[${i + 1}]: language required`; break; }
      if (!isValidUnsignedInt(r.spoken) || !isValidUnsignedInt(r.written)) {
        e.adolescentLanguages = `AdolescentLanguages[${i + 1}]: spoken/written must be integers`; break;
      }
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

  const hasErrors = Boolean(Object.values(errors).some(Boolean));

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors());
  }, [form, showForm, viewing, rows]);

  // ---------- actions ----------
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
    }
  };

  const onDelete = async (row: Race) => {
    const ok = await confirm({
      title: 'Delete Race',
      body: `Delete "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter((r) => r.id !== row.id));

    try {
      await deleteRace(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Race "${row.id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({
        variant: 'danger',
        title: 'Delete failed',
        description: String(err instanceof Error ? err.message : err),
      });
    }
  };

  // ---------- table ----------
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

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Races</h2>

      {!showForm && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
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

      {showForm && (
        <div
          className={`form-panel ${viewing ? 'form-panel--view' : ''}`}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            background: 'var(--panel)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            {viewing ? 'View Race' : editingId ? 'Edit Race' : 'New Race'}
          </h3>

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
              disabled={booksLoading || viewing}
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
              <LabeledInput label="Recovery Multiplier" value={form.recoveryMultiplier} onChange={makeSignedFloatOnChange<typeof form>('recoveryMultiplier', setForm)} disabled={viewing} />
              <LabeledInput label="Background Options" value={form.backgroundOptions} onChange={makeUnsignedIntOnChange<typeof form>('backgroundOptions', setForm)} disabled={viewing} />
              <LabeledInput label="Exhaustion Bonus" value={form.exhaustionBonus} onChange={makeUnsignedIntOnChange<typeof form>('exhaustionBonus', setForm)} disabled={viewing} />
              <LabeledInput label="Stat Loss Racial Type" value={form.statLossRacialType} onChange={makeUnsignedIntOnChange<typeof form>('statLossRacialType', setForm)} disabled={viewing} />
              <LabeledInput label="Required Sleep" value={form.requiredSleep} onChange={makeUnsignedIntOnChange<typeof form>('requiredSleep', setForm)} disabled={viewing} />
              <LabeledInput label="Required Sleep Frequency" value={form.requiredSleepFrequency} onChange={makeUnsignedIntOnChange<typeof form>('requiredSleepFrequency', setForm)} disabled={viewing} />
              <LabeledInput label="Soul Departure" value={form.soulDeparture} onChange={makeUnsignedIntOnChange<typeof form>('soulDeparture', setForm)} disabled={viewing} />
              <LabeledInput label="Build Modifier" value={form.buildModifier} onChange={makeUnsignedIntOnChange<typeof form>('buildModifier', setForm)} disabled={viewing} />
              <LabeledInput label="Average Male Height" value={form.averageMaleHeight} onChange={makeUnsignedIntOnChange<typeof form>('averageMaleHeight', setForm)} disabled={viewing} />
              <LabeledInput label="Average Female Height" value={form.averageFemaleHeight} onChange={makeUnsignedIntOnChange<typeof form>('averageFemaleHeight', setForm)} disabled={viewing} />
              <LabeledInput label="Average Lifespan" value={form.averageLifespan} onChange={makeUnsignedIntOnChange<typeof form>('averageLifespan', setForm)} disabled={viewing} />
              <LabeledInput label="Male Weight Modifier" value={form.maleWeightModifier} onChange={makeUnsignedIntOnChange<typeof form>('maleWeightModifier', setForm)} disabled={viewing} />
              <LabeledInput label="Female Weight Modifier" value={form.femaleWeightModifier} onChange={makeUnsignedIntOnChange<typeof form>('femaleWeightModifier', setForm)} disabled={viewing} />
            </div>
          </section>

          {/* Progressions */}
          <section style={{ marginTop: 12 }}>
            <h4 style={{ margin: '8px 0' }}>Progressions</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <LabeledSelect label="Arcane" value={form.arcaneProgression} onChange={(v) => setForm((s) => ({ ...s, arcaneProgression: v }))} options={progressionOptions} disabled={progressionsLoading || viewing} error={viewing ? undefined : errors.arcaneProgression} />
              <LabeledSelect label="Arms" value={form.armsProgression} onChange={(v) => setForm((s) => ({ ...s, armsProgression: v }))} options={progressionOptions} disabled={progressionsLoading || viewing} error={viewing ? undefined : errors.armsProgression} />
              <LabeledSelect label="Channeling" value={form.channelingProgression} onChange={(v) => setForm((s) => ({ ...s, channelingProgression: v }))} options={progressionOptions} disabled={progressionsLoading || viewing} error={viewing ? undefined : errors.channelingProgression} />
              <LabeledSelect label="Essence" value={form.essenceProgression} onChange={(v) => setForm((s) => ({ ...s, essenceProgression: v }))} options={progressionOptions} disabled={progressionsLoading || viewing} error={viewing ? undefined : errors.essenceProgression} />
              <LabeledSelect label="Mentalism" value={form.mentalismProgression} onChange={(v) => setForm((s) => ({ ...s, mentalismProgression: v }))} options={progressionOptions} disabled={progressionsLoading || viewing} error={viewing ? undefined : errors.mentalismProgression} />
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
            loading={languagesLoading}
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
            loading={languagesLoading}
            viewing={viewing}
            error={errors.adolescentLanguages}
            showSomatic
          />

          {/* Stat bonuses */}
          <IdValueListEditor
            title="Stat Bonuses"
            rows={form.statBonuses}
            onChangeRows={(next) => setForm((s) => ({ ...s, statBonuses: next }))}
            options={statOptions}
            viewing={viewing}
            error={errors.statBonuses}
            signedValues
          />

          {/* Everyman skills */}
          <SkillListEditor
            title="Everyman Skills"
            rows={form.everymanSkills}
            onChangeRows={(next) => setForm((s) => ({ ...s, everymanSkills: next }))}
            idOptions={skillOptions}
            loading={skillsLoading}
            viewing={viewing}
            error={errors.everymanSkills}
          />

          {/* Restricted skills */}
          <SkillListEditor
            title="Restricted Skills"
            rows={form.restrictedSkills}
            onChangeRows={(next) => setForm((s) => ({ ...s, restrictedSkills: next }))}
            idOptions={skillOptions}
            loading={skillsLoading}
            viewing={viewing}
            error={errors.restrictedSkills}
          />

          {/* Everyman categories */}
          <IdListEditor
            title="Everyman Categories"
            rows={form.everymanCategories}
            onChangeRows={(next) => setForm((s) => ({ ...s, everymanCategories: next }))}
            options={categoryOptions}
            loading={categoriesLoading}
            viewing={viewing}
            columnLabel="Category"
          />

          {/* Restricted categories */}
          <IdListEditor
            title="Restricted Categories"
            rows={form.restrictedCategories}
            onChangeRows={(next) => setForm((s) => ({ ...s, restrictedCategories: next }))}
            options={categoryOptions}
            loading={categoriesLoading}
            viewing={viewing}
            columnLabel="Category"
          />

          {/* Skill bonuses */}
          <SkillValueListEditor
            title="Skill Bonuses"
            rows={form.skillBonuses}
            onChangeRows={(next) => setForm((s) => ({ ...s, skillBonuses: next }))}
            idOptions={skillOptions}
            loading={skillsLoading}
            viewing={viewing}
            error={errors.skillBonuses}
            signedValues
          />

          {/* Skill Category Choices Everyman */}
          <ChoiceListEditor<string, string>
            title="Skill Category Choices (Everyman)"
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
                  disabled={categoriesLoading || viewing}
                />
                {!viewing && (
                  <button type="button" onClick={removeOption} style={{ color: '#b00020' }}>
                    Remove
                  </button>
                )}
              </div>
            )}
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
        <DataTable<Race>
          ref={dtRef}
          rows={rows}
          columns={columns}
          rowId={(r) => r.id}
          initialSort={{ colId: 'name', dir: 'asc' }}
          searchQuery={query}
          globalFilter={globalFilter}
          mode="client"
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50, 100]}
          tableMinWidth={1200}
          zebra
          hover
          resizable
          persistKey="dt.race.v1"
          ariaLabel="Races"
        />
      )}
    </>
  );
}