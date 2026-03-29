import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchBooks,
  fetchProfessions, upsertProfession, deleteProfession,
  fetchSkills,
  fetchSkillCategories,
  fetchSkillGroups,
  fetchSpellLists,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  CheckboxGroup,
  CheckboxInput,
  ChoiceListEditor,
  IdCostListEditor,
  IdTypeListEditor,
  IdValueListEditor,
  LabeledInput,
  LabeledSelect,
  MarkupPreview,
  SkillTypeListEditor,
  SkillValueListEditor,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  Book,
  Profession,
  ProfessionSpellListChoice,
  ProfessionSkillBonus,
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
  Skill,
  SkillCategory,
  SkillGroup,
  SpellList,
} from '../../types';

import {
  REALMS, type Realm,
  STATS, type Stat,
  SPELL_USER_TYPES, type SpellUserType,
  SKILL_DEVELOPMENT_TYPES, type SkillDevelopmentType,
} from '../../types/enum';

import {
  isValidID, makeIDOnChange,
  isValidUnsignedInt, sanitizeUnsignedInt,
  isValidSignedInt,
} from '../../utils';

const prefix = 'PROFESSION_';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */

type SpellListChoiceVM = { numChoices: string; options: string[] };
type SkillBonusVM = { id: string; subcategory?: string | undefined; value: string };
type IdValueVM = { id: string; value: string };
type SkillDevTypeVM = { id: string; subcategory?: string | undefined; value: SkillDevelopmentType | '' };
type IdDevTypeVM = { id: string; value: SkillDevelopmentType | '' };
type SkillSubcategoryChoiceVM = { numChoices: string; type: SkillDevelopmentType | ''; options: string[] };
type SkillDevChoiceOptionVM = { id: string; subcategory?: string | undefined };
type SkillDevChoiceVM = { numChoices: string; type: SkillDevelopmentType | ''; options: SkillDevChoiceOptionVM[] };
type IdChoiceVM = { numChoices: string; type: SkillDevelopmentType | ''; options: string[] };
type CategoryCostVM = { category: string; cost: string };

type FormState = {
  id: string;
  name: string;
  description: string;

  book: string;
  spellUserType: SpellUserType | '';
  realms: Realm[];
  stats: Stat[];

  baseSpellListChoices: SpellListChoiceVM[];

  skillBonuses: SkillBonusVM[];
  skillCategoryProfessionBonuses: IdValueVM[];
  skillCategorySpecialBonuses: IdValueVM[];
  skillGroupProfessionBonuses: IdValueVM[];
  skillGroupSpecialBonuses: IdValueVM[];

  skillDevelopmentTypes: SkillDevTypeVM[];
  skillCategorySkillDevelopmentTypes: IdDevTypeVM[];
  skillGroupSkillDevelopmentTypes: IdDevTypeVM[];

  skillSubcategoryDevelopmentTypeChoices: SkillSubcategoryChoiceVM[];
  skillDevelopmentTypeChoices: SkillDevChoiceVM[];
  skillCategorySkillDevelopmentTypeChoices: IdChoiceVM[];
  skillGroupSkillDevelopmentTypeChoices: IdChoiceVM[];

  skillCategoryCosts: CategoryCostVM[];
};

type FormErrors = {
  id?: string;
  name?: string;
  book?: string;
  spellUserType?: string;
  realms?: string;
  stats?: string;
  baseSpellListChoices?: string;
  skillBonuses?: string;
  skillCategoryProfessionBonuses?: string;
  skillCategorySpecialBonuses?: string;
  skillGroupProfessionBonuses?: string;
  skillGroupSpecialBonuses?: string;
  skillDevelopmentTypes?: string;
  skillCategorySkillDevelopmentTypes?: string;
  skillGroupSkillDevelopmentTypes?: string;
  skillSubcategoryDevelopmentTypeChoices?: string;
  skillDevelopmentTypeChoices?: string;
  skillCategorySkillDevelopmentTypeChoices?: string;
  skillGroupSkillDevelopmentTypeChoices?: string;
  skillCategoryCosts?: string;
};

const emptyVM = (): FormState => ({
  id: prefix,
  name: '',
  description: '',

  book: '',
  spellUserType: '',
  realms: [],
  stats: [],

  baseSpellListChoices: [],

  skillBonuses: [],
  skillCategoryProfessionBonuses: [],
  skillCategorySpecialBonuses: [],
  skillGroupProfessionBonuses: [],
  skillGroupSpecialBonuses: [],

  skillDevelopmentTypes: [],
  skillCategorySkillDevelopmentTypes: [],
  skillGroupSkillDevelopmentTypes: [],

  skillSubcategoryDevelopmentTypeChoices: [],
  skillDevelopmentTypeChoices: [],
  skillCategorySkillDevelopmentTypeChoices: [],
  skillGroupSkillDevelopmentTypeChoices: [],

  skillCategoryCosts: [],
});

// ---------- VM converters ----------
const toVM = (x: Profession): FormState => ({
  id: x.id,
  name: x.name,
  description: x.description ?? '',

  book: x.book,
  spellUserType: x.spellUserType ?? '',
  realms: (x.realms ?? []) as Realm[],
  stats: (x.stats ?? []) as Stat[],

  baseSpellListChoices: (x.baseSpellListChoices ?? []).map((r) => ({
    numChoices: String(r.numChoices),
    options: r.options.slice(),
  })),

  skillBonuses: (x.skillBonuses ?? []).map((r) => ({
    id: r.id,
    subcategory: r.subcategory,
    value: String(r.value),
  })),
  skillCategoryProfessionBonuses: (x.skillCategoryProfessionBonuses ?? []).map((r) => ({ id: r.id, value: String(r.value) })),
  skillCategorySpecialBonuses: (x.skillCategorySpecialBonuses ?? []).map((r) => ({ id: r.id, value: String(r.value) })),
  skillGroupProfessionBonuses: (x.skillGroupProfessionBonuses ?? []).map((r) => ({ id: r.id, value: String(r.value) })),
  skillGroupSpecialBonuses: (x.skillGroupSpecialBonuses ?? []).map((r) => ({ id: r.id, value: String(r.value) })),

  skillDevelopmentTypes: (x.skillDevelopmentTypes ?? []).map((r) => ({
    id: r.id,
    subcategory: r.subcategory,
    value: r.value,
  })),
  skillCategorySkillDevelopmentTypes: (x.skillCategorySkillDevelopmentTypes ?? []).map((r) => ({ id: r.id, value: r.value })),
  skillGroupSkillDevelopmentTypes: (x.skillGroupSkillDevelopmentTypes ?? []).map((r) => ({ id: r.id, value: r.value })),

  skillSubcategoryDevelopmentTypeChoices: (x.skillSubcategoryDevelopmentTypeChoices ?? []).map((r) => ({
    numChoices: String(r.numChoices),
    type: r.type,
    options: r.options.slice(),
  })),
  skillDevelopmentTypeChoices: (x.skillDevelopmentTypeChoices ?? []).map((r) => ({
    numChoices: String(r.numChoices),
    type: r.type,
    options: r.options.map((o) => ({ id: o.id, subcategory: o.subcategory })),
  })),
  skillCategorySkillDevelopmentTypeChoices: (x.skillCategorySkillDevelopmentTypeChoices ?? []).map((r) => ({
    numChoices: String(r.numChoices),
    type: r.type,
    options: r.options.slice(),
  })),
  skillGroupSkillDevelopmentTypeChoices: (x.skillGroupSkillDevelopmentTypeChoices ?? []).map((r) => ({
    numChoices: String(r.numChoices),
    type: r.type,
    options: r.options.slice(),
  })),

  skillCategoryCosts: (x.skillCategoryCosts ?? []).map((r) => ({
    category: r.category,
    cost: r.cost,
  })),
});

const fromVM = (vm: FormState): Profession => ({
  id: vm.id.trim(),
  name: vm.name.trim(),
  description: vm.description.trim() || undefined,

  book: vm.book.trim(),
  spellUserType: vm.spellUserType as SpellUserType,
  realms: vm.realms.slice() as Realm[],
  stats: vm.stats.slice() as Stat[],

  baseSpellListChoices: vm.baseSpellListChoices.map((r): ProfessionSpellListChoice => ({
    numChoices: Number(r.numChoices),
    options: r.options.slice(),
  })),

  skillBonuses: vm.skillBonuses.map((r): ProfessionSkillBonus => ({
    id: r.id,
    subcategory: r.subcategory?.trim() || undefined,
    value: Number(r.value),
  })),

  skillCategoryProfessionBonuses: vm.skillCategoryProfessionBonuses.map((r): ProfessionCategoryBonus => ({
    id: r.id,
    value: Number(r.value),
  })),
  skillCategorySpecialBonuses: vm.skillCategorySpecialBonuses.map((r): ProfessionCategoryBonus => ({
    id: r.id,
    value: Number(r.value),
  })),
  skillGroupProfessionBonuses: vm.skillGroupProfessionBonuses.map((r): ProfessionGroupBonus => ({
    id: r.id,
    value: Number(r.value),
  })),
  skillGroupSpecialBonuses: vm.skillGroupSpecialBonuses.map((r): ProfessionGroupBonus => ({
    id: r.id,
    value: Number(r.value),
  })),

  skillDevelopmentTypes: vm.skillDevelopmentTypes.map((r): ProfessionSkillDevelopmentType => ({
    id: r.id,
    subcategory: r.subcategory?.trim() || undefined,
    value: r.value as SkillDevelopmentType,
  })),
  skillCategorySkillDevelopmentTypes: vm.skillCategorySkillDevelopmentTypes.map((r): ProfessionCategorySkillDevelopmentType => ({
    id: r.id,
    value: r.value as SkillDevelopmentType,
  })),
  skillGroupSkillDevelopmentTypes: vm.skillGroupSkillDevelopmentTypes.map((r): ProfessionGroupSkillDevelopmentType => ({
    id: r.id,
    value: r.value as SkillDevelopmentType,
  })),

  skillSubcategoryDevelopmentTypeChoices: vm.skillSubcategoryDevelopmentTypeChoices.map((r): ProfessionSkillSubcategoryDevelopmentTypeChoice => ({
    numChoices: Number(r.numChoices),
    type: r.type as SkillDevelopmentType,
    options: r.options.slice(),
  })),
  skillDevelopmentTypeChoices: vm.skillDevelopmentTypeChoices.map((r): ProfessionSkillDevelopmentTypeChoice => ({
    numChoices: Number(r.numChoices),
    type: r.type as SkillDevelopmentType,
    options: r.options.map((o): ProfessionSkillDevelopmentTypeChoiceOption => ({
      id: o.id,
      subcategory: o.subcategory?.trim() || undefined,
    })),
  })),
  skillCategorySkillDevelopmentTypeChoices: vm.skillCategorySkillDevelopmentTypeChoices.map((r): ProfessionCategorySkillDevelopmentTypeChoice => ({
    numChoices: Number(r.numChoices),
    type: r.type as SkillDevelopmentType,
    options: r.options.slice(),
  })),
  skillGroupSkillDevelopmentTypeChoices: vm.skillGroupSkillDevelopmentTypeChoices.map((r): ProfessionGroupSkillDevelopmentTypeChoice => ({
    numChoices: Number(r.numChoices),
    type: r.type as SkillDevelopmentType,
    options: r.options.slice(),
  })),

  skillCategoryCosts: vm.skillCategoryCosts.map((r): ProfessionSkillCategoryCost => ({
    category: r.category,
    cost: r.cost,
  })),
});

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */

export default function ProfessionView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<Profession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  // reference lists
  const [books, setBooks] = useState<Book[]>([]);
  const [spellLists, setSpellLists] = useState<SpellList[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [groups, setGroups] = useState<SkillGroup[]>([]);

  const [query, setQuery] = useState('');
  const [spellUserTypeFilter, setSpellUserTypeFilter] = useState<SpellUserType | ''>('');
  const [realmFilters, setRealmFilters] = useState<Realm[]>([]);
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
        const [p, b, s, c, g, sl] = await Promise.all([
          fetchProfessions(),
          fetchBooks(),
          fetchSkills(),
          fetchSkillCategories(),
          fetchSkillGroups(),
          fetchSpellLists(),
        ]);
        setRows(p);
        setBooks(b);
        setSkills(s);
        setCategories(c);
        setGroups(g);
        setSpellLists(sl);
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

  const bookOptions = useMemo(
    () => books.map(b => ({ value: b.id, label: b.name })),
    [books]
  );
  const spellListOptions = useMemo(
    () => spellLists.map(s => ({ value: s.id, label: s.name })),
    [spellLists]
  );
  const skillOptions = useMemo(
    () => skills.map(s => ({ value: s.id, label: s.name })),
    [skills]
  );
  const categoryOptions = useMemo(
    () => categories.map(c => ({ value: c.id, label: `(${sgNameById.get(c.group) ?? c.group}) - ${c.name}` })),
    [categories, sgNameById]
  );
  const groupOptions = useMemo(
    () => groups.map(g => ({ value: g.id, label: g.name })),
    [groups]
  );

  const realmOptions = useMemo(
    () => REALMS.map(v => ({ value: v, label: v })),
    []
  );
  const statOptions = useMemo(
    () => STATS.map(v => ({ value: v, label: v })),
    []
  );
  const spellUserTypeOptions = useMemo(
    () => SPELL_USER_TYPES.map(v => ({ value: v, label: v })),
    []
  );
  const developmentTypeOptions = useMemo(
    () => SKILL_DEVELOPMENT_TYPES.map(v => ({ value: v, label: v })),
    []
  );

  /* ------------------------------------------------------------------ */
  /* Validation                                                         */
  /* ------------------------------------------------------------------ */

  // 1–3 colon-separated positive numbers, e.g. "11", "3:3:3", "10:10"
  const COST_RE = /^[1-9]\d*(?::[1-9]\d*){0,2}$/;

  const computeErrors = (draft: FormState): FormErrors => {
    const e: typeof errors = {};

    const id = draft.id.trim();
    const nm = draft.name.trim();
    if (!id) e.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === id)) e.id = `ID "${id}" already exists`;
    else if (!isValidID(id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;

    if (!nm) e.name = 'Name is required';
    if (!draft.book) e.book = 'Book is required';
    if (!draft.spellUserType) e.spellUserType = 'Spell user type is required';
    if (!draft.realms.length) e.realms = 'Select at least one realm';
    if (!draft.stats.length) e.stats = 'Select at least one stat';

    // base spell list choices
    for (let i = 0; i < draft.baseSpellListChoices.length; i++) {
      const row = draft.baseSpellListChoices[i];
      if (!row) continue;
      if (!isValidUnsignedInt(row.numChoices) || Number(row.numChoices) <= 0) {
        e.baseSpellListChoices = `BaseSpellListChoices[${i + 1}]: numChoices must be a positive integer`;
        break;
      }
      if (!row.options.length || row.options.some(o => !o)) {
        e.baseSpellListChoices = `BaseSpellListChoices[${i + 1}]: choose at least one spell list`;
        break;
      }
    }

    // skill bonuses
    for (let i = 0; i < draft.skillBonuses.length; i++) {
      const r = draft.skillBonuses[i];
      if (!r) continue;
      if (!r.id) { e.skillBonuses = `SkillBonuses[${i + 1}]: skill id required`; break; }
      if (!isValidSignedInt(r.value ?? '')) { e.skillBonuses = `SkillBonuses[${i + 1}]: value must be an integer`; break; }
    }

    const checkIdValue = (label: keyof typeof e, arr: IdValueVM[], entityName: string) => {
      for (let i = 0; i < arr.length; i++) {
        const r = arr[i];
        if (!r) continue;
        if (!r.id) { e[label] = `${entityName}[${i + 1}]: id required`; break; }
        if (!isValidSignedInt(r.value ?? '')) { e[label] = `${entityName}[${i + 1}]: value must be an integer`; break; }
      }
    };
    checkIdValue('skillCategoryProfessionBonuses', draft.skillCategoryProfessionBonuses, 'SkillCategoryProfessionBonuses');
    checkIdValue('skillCategorySpecialBonuses', draft.skillCategorySpecialBonuses, 'SkillCategorySpecialBonuses');
    checkIdValue('skillGroupProfessionBonuses', draft.skillGroupProfessionBonuses, 'SkillGroupProfessionBonuses');
    checkIdValue('skillGroupSpecialBonuses', draft.skillGroupSpecialBonuses, 'SkillGroupSpecialBonuses');

    for (let i = 0; i < draft.skillDevelopmentTypes.length; i++) {
      const r = draft.skillDevelopmentTypes[i];
      if (!r) continue;
      if (!r.id) { e.skillDevelopmentTypes = `SkillDevelopmentTypes[${i + 1}]: skill id required`; break; }
      if (!r.value) { e.skillDevelopmentTypes = `SkillDevelopmentTypes[${i + 1}]: type required`; break; }
    }
    const checkIdDevType = (label: keyof typeof e, arr: IdDevTypeVM[], entityName: string) => {
      for (let i = 0; i < arr.length; i++) {
        const r = arr[i];
        if (!r) continue;
        if (!r.id) { e[label] = `${entityName}[${i + 1}]: id required`; break; }
        if (!r.value) { e[label] = `${entityName}[${i + 1}]: type required`; break; }
      }
    };
    checkIdDevType('skillCategorySkillDevelopmentTypes', draft.skillCategorySkillDevelopmentTypes, 'SkillCategorySkillDevelopmentTypes');
    checkIdDevType('skillGroupSkillDevelopmentTypes', draft.skillGroupSkillDevelopmentTypes, 'SkillGroupSkillDevelopmentTypes');

    const checkChoice = (
      label: keyof typeof e,
      arr: Array<{ numChoices: string; type: SkillDevelopmentType | ''; options: any[] }>,
      entityName: string
    ) => {
      for (let i = 0; i < arr.length; i++) {
        const r = arr[i];
        if (!r) continue;
        if (!isValidUnsignedInt(r.numChoices) || Number(r.numChoices) <= 0) {
          e[label] = `${entityName}[${i + 1}]: numChoices must be a positive integer`; break;
        }
        if (!r.type) { e[label] = `${entityName}[${i + 1}]: type required`; break; }
        if (!r.options.length) { e[label] = `${entityName}[${i + 1}]: add at least one option`; break; }
      }
    };
    checkChoice('skillSubcategoryDevelopmentTypeChoices', draft.skillSubcategoryDevelopmentTypeChoices, 'SkillSubcategoryDevelopmentTypeChoices');
    checkChoice('skillDevelopmentTypeChoices', draft.skillDevelopmentTypeChoices, 'SkillDevelopmentTypeChoices');
    checkChoice('skillCategorySkillDevelopmentTypeChoices', draft.skillCategorySkillDevelopmentTypeChoices, 'SkillCategorySkillDevelopmentTypeChoices');
    checkChoice('skillGroupSkillDevelopmentTypeChoices', draft.skillGroupSkillDevelopmentTypeChoices, 'SkillGroupSkillDevelopmentTypeChoices');

    // ensure option ids exist for skillDevelopmentTypeChoices
    for (let i = 0; i < draft.skillDevelopmentTypeChoices.length; i++) {
      const row = draft.skillDevelopmentTypeChoices[i];
      if (!row) continue;
      for (let j = 0; j < row.options.length; j++) {
        if (!row.options[j]) continue;
        const option = row.options[j] as SkillDevChoiceOptionVM;
        if (!option.id) {
          e.skillDevelopmentTypeChoices = `SkillDevelopmentTypeChoices[${i + 1}].options[${j + 1}]: skill id required`;
          break;
        }
      }
      if (e.skillDevelopmentTypeChoices) break;
    }

    for (let i = 0; i < draft.skillCategoryCosts.length; i++) {
      const r = draft.skillCategoryCosts[i];
      if (!r) continue;
      if (!r.category) { e.skillCategoryCosts = `SkillCategoryCosts[${i + 1}]: category required`; break; }
      if (!COST_RE.test(r.cost.trim())) {
        e.skillCategoryCosts = `SkillCategoryCosts[${i + 1}]: cost must be 1-3 colon-separated positive numbers`;
        break;
      }
    }

    return e;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing, rows]);

  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */
  const columns: ColumnDef<Profession>[] = useMemo(() => [
    { id: 'id', header: 'ID', accessor: r => r.id, sortType: 'string', minWidth: 260 },
    { id: 'name', header: 'Name', accessor: r => r.name, sortType: 'string', minWidth: 180 },
    { id: 'spellUserType', header: 'Spell User Type', accessor: r => r.spellUserType, sortType: 'string', minWidth: 140 },
    {
      id: 'realms', header: 'Realms', accessor: r => r.realms.join(','), sortType: 'string', minWidth: 180,
      render: r => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {r.realms.map((s, i) => (
            <span key={`${s}-${i}`} style={{ display: 'inline-block', padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 999, fontSize: 12 }}>
              {s}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'stats', header: 'Stats', accessor: r => r.stats.join(','), sortType: 'string', minWidth: 220,
      render: r => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {r.stats.map((s, i) => (
            <span key={`${s}-${i}`} style={{ display: 'inline-block', padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 999, fontSize: 12 }}>
              {s}
            </span>
          ))}
        </div>
      )
    },
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

  const globalFilter = (r: Profession, q: string) => {
    const s = q.toLowerCase();
    return [
      r.id, r.name, r.description ?? '', r.book, r.spellUserType,
      r.realms.join(','), r.stats.join(','),
    ].some(v => String(v ?? '').toLowerCase().includes(s));
  };

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesSpellUserType = !spellUserTypeFilter || r.spellUserType === spellUserTypeFilter;
      const matchesRealms = realmFilters.length === 0 || realmFilters.every((realm) => r.realms.includes(realm));
      return matchesSpellUserType && matchesRealms;
    });
  }, [rows, spellUserTypeFilter, realmFilters]);

  const hasActiveFilters = spellUserTypeFilter !== '' || realmFilters.length > 0;

  useEffect(() => {
    setPage(1);
  }, [spellUserTypeFilter, realmFilters]);

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

  const startView = (row: Profession) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: Profession) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: Profession) => {
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
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };

      await upsertProfession(payload, opts);

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
        description: `Profession "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: Profession) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Profession',
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
      await deleteProfession(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Profession "${row.id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err), });
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- reusable updaters (guard + narrow + full-object writes) ----------
  const updateSpellListChoiceAt = (index: number, patch: Partial<SpellListChoiceVM>) => {
    setForm((s) => {
      const copy = s.baseSpellListChoices.slice();
      if (index < 0 || index >= copy.length) return s;
      const current = copy[index];
      if (!current) return s;
      copy[index] = {
        numChoices: patch.numChoices ?? current.numChoices,
        options: patch.options ?? current.options.slice(),
      };
      return { ...s, baseSpellListChoices: copy };
    });
  };

  const toggleStringInArray = (
    key: 'realms' | 'stats',
    value: string
  ) => {
    setForm((s) => {
      const arr = [...(s[key] as string[])];
      const ix = arr.indexOf(value);
      if (ix >= 0) arr.splice(ix, 1);
      else arr.push(value);
      return { ...s, [key]: arr };
    });
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Professions</h2>

      {/* Toolbar hidden while form visible */}
      {!showForm && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={startNew}>New Profession</button>
            <DataTableSearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search professions…"
              aria-label="Search professions"
            />

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>Spell User Type</span>
              <select
                value={spellUserTypeFilter}
                onChange={(e) => setSpellUserTypeFilter(e.target.value as SpellUserType | '')}
                aria-label="Filter by spell user type"
                style={{ padding: '6px 8px' }}
              >
                <option value="">All</option>
                {SPELL_USER_TYPES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSpellUserTypeFilter('');
                  setRealmFilters([]);
                }}
              >
                Clear filters
              </button>
            )}

            {/* Reset and auto-fit column widths */}
            <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
            <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <CheckboxGroup<Realm>
              label="Realms"
              value={realmFilters}
              options={realmOptions}
              onChange={setRealmFilters}
              inline
              showSelectAll
            />
          </div>
        </div>
      )}

      {/* Display main Form */}
      {showForm && (
        <div className="form-container">
          {/* Simple overlay while submitting */}
          {submitting && (<div className="overlay"><Spinner size={24} /> <span>Saving…</span> </div>)}

          <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`}>
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Profession</h3>

            {/* Basic fields */}
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

              <LabeledSelect
                label="Spell User Type"
                value={form.spellUserType}
                onChange={(v) => setForm((s) => ({ ...s, spellUserType: v as SpellUserType }))}
                options={spellUserTypeOptions}
                disabled={viewing}
                error={viewing ? undefined : errors.spellUserType}
              />
            </div>

            {/* Description with preview */}
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
                    rows={4}
                  />
                </label>
              )}
            </section>

            {/* Realms / Stats */}
            <section style={{ marginTop: 12 }}>
              <h4 style={{ margin: '8px 0' }}>Realms</h4>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {realmOptions.map((opt) => (
                  <CheckboxInput
                    key={opt.value}
                    label={opt.label}
                    checked={form.realms.includes(opt.value as Realm)}
                    onChange={() => toggleStringInArray('realms', opt.value)}
                    disabled={viewing}
                  />
                ))}
              </div>
              {errors.realms && <div style={{ color: '#b00020', marginTop: 6 }}>{errors.realms}</div>}

              <h4 style={{ margin: '16px 0 8px' }}>Stats</h4>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {statOptions.map((opt) => (
                  <CheckboxInput
                    key={opt.value}
                    label={opt.label}
                    checked={form.stats.includes(opt.value as Stat)}
                    onChange={() => toggleStringInArray('stats', opt.value)}
                    disabled={viewing}
                  />
                ))}
              </div>
              {errors.stats && <div style={{ color: '#b00020', marginTop: 6 }}>{errors.stats}</div>}
            </section>

            {/* Base Spell List Choices */}
            <section style={{ marginTop: 12 }}>
              <h4 style={{ margin: '8px 0' }}>Base Spell List Choices</h4>
              {!viewing && (
                <button
                  type="button"
                  onClick={() => setForm((s) => ({
                    ...s,
                    baseSpellListChoices: [...s.baseSpellListChoices, { numChoices: '', options: [] }],
                  }))}
                  style={{ marginBottom: 8 }}
                >
                  + Add spell list choice row
                </button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8 }}>
                {form.baseSpellListChoices.length > 0 && <div style={{ fontWeight: 600 }}>Num Choices</div>}
                {form.baseSpellListChoices.length > 0 && <div style={{ fontWeight: 600 }}>Options (Spell Lists)</div>}
                {form.baseSpellListChoices.map((row, i) => (
                  <React.Fragment key={`bsl-${i}`}>
                    <LabeledInput
                      label="Num Choices"
                      hideLabel
                      ariaLabel="Num choices"
                      value={row.numChoices}
                      onChange={(v) => updateSpellListChoiceAt(i, { numChoices: sanitizeUnsignedInt(v) })}
                      disabled={viewing}
                      width={120}
                    />
                    <div style={{ display: 'grid', gap: 8 }}>
                      {!viewing && (
                        <button
                          type="button"
                          onClick={() => updateSpellListChoiceAt(i, { options: [...row.options, ''] })}
                        >
                          + Add spell list option
                        </button>
                      )}
                      {row.options.map((opt, oi) => (
                        <div key={`bsl-${i}-opt-${oi}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                          <LabeledSelect
                            label="Spell List"
                            hideLabel
                            value={opt}
                            onChange={(v) => {
                              const nextOpts = row.options.slice();
                              if (oi < 0 || oi >= nextOpts.length) return;
                              nextOpts[oi] = v;
                              updateSpellListChoiceAt(i, { options: nextOpts });
                            }}
                            options={spellListOptions}
                            disabled={loading || viewing}
                          />
                          {!viewing && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextOpts = row.options.slice();
                                if (oi < 0 || oi >= nextOpts.length) return;
                                nextOpts.splice(oi, 1);
                                updateSpellListChoiceAt(i, { options: nextOpts });
                              }}
                              style={{ color: '#b00020' }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                      {!viewing && (
                        <button
                          type="button"
                          onClick={() => setForm((s) => {
                            const copy = s.baseSpellListChoices.slice();
                            if (i < 0 || i >= copy.length) return s;
                            copy.splice(i, 1);
                            return { ...s, baseSpellListChoices: copy };
                          })}
                          style={{ color: '#b00020' }}
                        >
                          Remove row
                        </button>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
              {errors.baseSpellListChoices && <div style={{ color: '#b00020', marginTop: 6 }}>{errors.baseSpellListChoices}</div>}
            </section>

            {/* Skill Bonuses */}
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

            {/* Category/Group bonus sections */}
            <IdValueListEditor
              title="Skill Category Profession Bonuses"
              addButtonLabel='+ Add category profession bonus'
              rows={form.skillCategoryProfessionBonuses}
              onChangeRows={(next) => setForm((s) => ({ ...s, skillCategoryProfessionBonuses: next }))}
              options={categoryOptions}
              loading={loading}
              viewing={viewing}
              error={errors.skillCategoryProfessionBonuses}
              signedValues
            />

            <IdValueListEditor
              title="Skill Category Special Bonuses"
              addButtonLabel='+ Add category special bonus'
              rows={form.skillCategorySpecialBonuses}
              onChangeRows={(next) => setForm((s) => ({ ...s, skillCategorySpecialBonuses: next }))}
              options={categoryOptions}
              loading={loading}
              viewing={viewing}
              error={errors.skillCategorySpecialBonuses}
              signedValues
            />

            <IdValueListEditor
              title="Skill Group Profession Bonuses"
              addButtonLabel='+ Add group profession bonus'
              rows={form.skillGroupProfessionBonuses}
              onChangeRows={(next) => setForm((s) => ({ ...s, skillGroupProfessionBonuses: next }))}
              options={groupOptions}
              loading={loading}
              viewing={viewing}
              error={errors.skillGroupProfessionBonuses}
              signedValues
            />

            <IdValueListEditor
              title="Skill Group Special Bonuses"
              addButtonLabel='+ Add group special bonus'
              rows={form.skillGroupSpecialBonuses}
              onChangeRows={(next) => setForm((s) => ({ ...s, skillGroupSpecialBonuses: next }))}
              options={groupOptions}
              loading={loading}
              viewing={viewing}
              error={errors.skillGroupSpecialBonuses}
              signedValues
            />

            {/* Skill Development Types */}
            <SkillTypeListEditor<SkillDevelopmentType>
              title="Skill Development Types"
              addButtonLabel='+ Add skill development type'
              rows={form.skillDevelopmentTypes}
              onChangeRows={(next) =>
                setForm((s) => ({ ...s, skillDevelopmentTypes: next }))
              }
              idOptions={skillOptions}
              typeOptions={developmentTypeOptions}
              loading={loading}
              viewing={viewing}
              error={errors.skillDevelopmentTypes}
            />

            {/* Category / Group Skill Development Types */}
            <IdTypeListEditor<string, SkillDevelopmentType>
              title="Skill Category Skill Development Types"
              addButtonLabel='+ Add category skill development type'
              rows={form.skillCategorySkillDevelopmentTypes}
              onChangeRows={(next) =>
                setForm((s) => ({ ...s, skillCategorySkillDevelopmentTypes: next }))
              }
              idOptions={categoryOptions}
              typeOptions={developmentTypeOptions}
              loading={loading}
              viewing={viewing}
              error={errors.skillCategorySkillDevelopmentTypes}
            />

            <IdTypeListEditor<string, SkillDevelopmentType>
              title="Skill Group Skill Development Types"
              addButtonLabel='+ Add group skill development type'
              rows={form.skillGroupSkillDevelopmentTypes}
              onChangeRows={(next) =>
                setForm((s) => ({ ...s, skillGroupSkillDevelopmentTypes: next }))
              }
              idOptions={groupOptions}
              typeOptions={developmentTypeOptions}
              loading={loading}
              viewing={viewing}
              error={errors.skillGroupSkillDevelopmentTypes}
            />

            {/* Skill Subcategory Development Type Choices */}
            <ChoiceListEditor<SkillDevelopmentType, string>
              title="Skill Subcategory Development Type Choices"
              addRowButtonLabel='+ Add subcategory development type choice'
              rows={form.skillSubcategoryDevelopmentTypeChoices}
              onChangeRows={(next) =>
                setForm((s) => ({ ...s, skillSubcategoryDevelopmentTypeChoices: next }))
              }
              typeOptions={developmentTypeOptions}
              viewing={viewing}
              error={errors.skillSubcategoryDevelopmentTypeChoices}
              createEmptyOption={() => ''}
              renderOptionEditor={({ option, setOption, removeOption, viewing }) => (
                <div style={{ display: 'grid', gridTemplateColumns: viewing ? 'minmax(280px, 1fr) 1fr' : 'minmax(280px, 1fr) 1fr auto', gap: 8, }} >
                  <LabeledSelect label="Skill" hideLabel ariaLabel="Skill" value={option} onChange={(v) => setOption(v)} options={skillOptions} disabled={loading || viewing} />
                  {!viewing && (<button type="button" onClick={removeOption} style={{ color: '#b00020' }}>Remove</button>)}
                </div>
              )}
            />

            {/* Skill Development Type Choices */}
            <ChoiceListEditor<SkillDevelopmentType, { id: string; subcategory?: string | undefined }>
              addRowButtonLabel='+ Add skill development type choice'
              title="Skill Development Type Choices"
              rows={form.skillDevelopmentTypeChoices}
              onChangeRows={(next) =>
                setForm((s) => ({ ...s, skillDevelopmentTypeChoices: next }))
              }
              typeOptions={developmentTypeOptions}
              viewing={viewing}
              error={errors.skillDevelopmentTypeChoices}
              createEmptyOption={() => ({ id: '', subcategory: '' })}
              renderOptionEditor={({ option, setOption, removeOption, viewing }) => (
                <div style={{ display: 'grid', gridTemplateColumns: viewing ? 'minmax(280px, 1fr) 1fr' : 'minmax(280px, 1fr) 1fr auto', gap: 8, }} >
                  <LabeledSelect label="Skill" hideLabel ariaLabel="Skill" value={option.id} onChange={(v) => setOption({ id: v, subcategory: option.subcategory, })} options={skillOptions} disabled={loading || viewing} />
                  <LabeledInput label="Subcategory" hideLabel ariaLabel="Subcategory" value={option.subcategory ?? ''} onChange={(v) => setOption({ id: option.id, subcategory: v || undefined, })} disabled={viewing} />
                  {!viewing && (<button type="button" onClick={removeOption} style={{ color: '#b00020' }}>Remove</button>)}
                </div>
              )}
            />

            {/* Category / Group choice sections */}
            <ChoiceListEditor<SkillDevelopmentType, string>
              title="Skill Category Skill Development Type Choices"
              addRowButtonLabel='+ Add category skill development type choice'
              rows={form.skillCategorySkillDevelopmentTypeChoices}
              onChangeRows={(next) =>
                setForm((s) => ({ ...s, skillCategorySkillDevelopmentTypeChoices: next }))
              }
              typeOptions={developmentTypeOptions}
              viewing={viewing}
              error={errors.skillCategorySkillDevelopmentTypeChoices}
              createEmptyOption={() => ''}
              renderOptionEditor={({ option, setOption, removeOption, viewing }) => (
                <div style={{ display: 'grid', gridTemplateColumns: viewing ? '1fr' : '1fr auto', gap: 8 }}>
                  <LabeledSelect label="Category" hideLabel ariaLabel="Category" value={option} onChange={(v) => setOption(v)} options={categoryOptions} disabled={loading || viewing} />
                  {!viewing && (<button type="button" onClick={removeOption} style={{ color: '#b00020' }}>Remove</button>)}
                </div>
              )}
            />

            <ChoiceListEditor<SkillDevelopmentType, string>
              title="Skill Group Skill Development Type Choices"
              addRowButtonLabel='+ Add group skill development type choice'
              rows={form.skillGroupSkillDevelopmentTypeChoices}
              onChangeRows={(next) =>
                setForm((s) => ({ ...s, skillGroupSkillDevelopmentTypeChoices: next }))
              }
              typeOptions={developmentTypeOptions}
              viewing={viewing}
              error={errors.skillGroupSkillDevelopmentTypeChoices}
              createEmptyOption={() => ''}
              renderOptionEditor={({ option, setOption, removeOption, viewing }) => (
                <div style={{ display: 'grid', gridTemplateColumns: viewing ? '1fr' : '1fr auto', gap: 8 }} >
                  <LabeledSelect label="Group" hideLabel ariaLabel="Group" value={option} onChange={(v) => setOption(v)} options={groupOptions} disabled={loading || viewing} />
                  {!viewing && (<button type="button" onClick={removeOption} style={{ color: '#b00020' }}>Remove</button>)}
                </div>
              )}
            />

            {/* Skill Category Costs */}
            <IdCostListEditor
              title="Skill Category Costs"
              addButtonLabel='+ Add skill category cost'
              rows={form.skillCategoryCosts}
              onChangeRows={(next) =>
                setForm((s) => ({ ...s, skillCategoryCosts: next }))
              }
              categoryOptions={categoryOptions}
              loading={loading}
              viewing={viewing}
              error={errors.skillCategoryCosts}
              costWidth={140}
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
          persistKey="dt.profession.v1"
          ariaLabel="Professions"
        />
      )}
    </>
  );
}