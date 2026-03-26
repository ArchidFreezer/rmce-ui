import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchArmourTypes,
  fetchClimates,
  fetchCulturetypes, upsertCulturetype, deleteCulturetype,
  fetchSkills,
  fetchSkillcategories,
  fetchSkillgroups,
  fetchWeaponTypes,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  IdListEditor,
  IdValueListEditor,
  LabeledInput,
  MarkupPreview,
  PillList,
  SkillValueListEditor,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  ArmourType,
  Climate,
  CultureType,
  Skill,
  SkillCategory,
  SkillGroup,
  WeaponType,
} from '../../types';

import {
  ENVIRONMENT_FEATURES, asFeatureArray,
  ENVIRONMENT_TERRAINS, asTerrainArray,
  ENVIRONMENT_VEGETATIONS, asVegetationArray,
  ENVIRONMENT_WATER_BODIES, asWaterBodyArray,
} from '../../types/enum';

import {
  isValidID, makeIDOnChange,
  isValidUnsignedInt, makeUnsignedIntOnChange,
} from '../../utils';

const prefix = 'CULTURETYPE_';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */
type SkillRankVM = { id: string; subcategory?: string | undefined; value: string };
type CategoryRankVM = { id: string; value: string };

type FormState = {
  id: string;
  name: string;

  description: string;
  characterConcepts: string;
  clothing: string;
  aspirations: string;
  fears: string;
  marriagePatterns: string;
  prejudices: string;
  religiousBeliefs: string;

  hobbySkillRanks: string;

  preferredArmours: string[]; // ArmourType.id
  preferredWeapons: string[]; // WeaponType.id

  skillRanks: SkillRankVM[];
  skillCategoryRanks: CategoryRankVM[];
  skillCategorySkillRanks: CategoryRankVM[];

  requiredClimates: string[];
  requiredFeatures: string[];
  requiredTerrains: string[];
  requiredVegetations: string[];
  requiredWaterSources: string[];
};

type FormErrors = {
  id?: string | undefined;
  name?: string | undefined;
  hobbySkillRanks?: string | undefined;

  preferredArmours?: string | undefined;
  preferredWeapons?: string | undefined;

  skillRanks?: string | undefined;
  skillCategoryRanks?: string | undefined;
  skillCategorySkillRanks?: string | undefined;

  requiredClimates?: string | undefined;
  requiredFeatures?: string | undefined;
  requiredTerrains?: string | undefined;
  requiredVegetations?: string | undefined;
  requiredWaterSources?: string | undefined;
};

const emptyVM = (): FormState => ({
  id: prefix,
  name: '',

  description: '',
  characterConcepts: '',
  clothing: '',
  aspirations: '',
  fears: '',
  marriagePatterns: '',
  prejudices: '',
  religiousBeliefs: '',

  hobbySkillRanks: '',

  preferredArmours: [],
  preferredWeapons: [],

  skillRanks: [],
  skillCategoryRanks: [],
  skillCategorySkillRanks: [],

  requiredClimates: [],
  requiredFeatures: [],
  requiredTerrains: [],
  requiredVegetations: [],
  requiredWaterSources: [],
});

const toVM = (x: CultureType): FormState => ({
  id: x.id,
  name: x.name,

  description: x.description ?? '',
  characterConcepts: x.characterConcepts ?? '',
  clothing: x.clothing ?? '',
  aspirations: x.aspirations ?? '',
  fears: x.fears ?? '',
  marriagePatterns: x.marriagePatterns ?? '',
  prejudices: x.prejudices ?? '',
  religiousBeliefs: x.religiousBeliefs ?? '',

  hobbySkillRanks: String(x.hobbySkillRanks),

  preferredArmours: x.preferredArmours ?? [],
  preferredWeapons: x.preferredWeapons ?? [],

  skillRanks: (x.skillRanks ?? []).map(r => ({ id: r.id, subcategory: r.subcategory, value: String(r.value) })),
  skillCategoryRanks: (x.skillCategoryRanks ?? []).map(r => ({ id: r.id, value: String(r.value) })),
  skillCategorySkillRanks: (x.skillCategorySkillRanks ?? []).map(r => ({ id: r.id, value: String(r.value) })),

  requiredClimates: x.requiredClimates ?? [],
  requiredFeatures: x.requiredFeatures ?? [],
  requiredTerrains: x.requiredTerrains ?? [],
  requiredVegetations: x.requiredVegetations ?? [],
  requiredWaterSources: x.requiredWaterSources ?? [],
});

const fromVM = (vm: FormState): CultureType => ({
  id: vm.id.trim(),
  name: vm.name.trim(),

  description: vm.description.trim() || undefined,
  characterConcepts: vm.characterConcepts.trim() || undefined,
  clothing: vm.clothing.trim() || undefined,
  aspirations: vm.aspirations.trim() || undefined,
  fears: vm.fears.trim() || undefined,
  marriagePatterns: vm.marriagePatterns.trim() || undefined,
  prejudices: vm.prejudices.trim() || undefined,
  religiousBeliefs: vm.religiousBeliefs.trim() || undefined,

  hobbySkillRanks: Number(vm.hobbySkillRanks),

  preferredArmours: vm.preferredArmours.slice(),
  preferredWeapons: vm.preferredWeapons.slice(),

  skillRanks: vm.skillRanks.map(r => ({
    id: r.id,
    subcategory: r.subcategory?.trim() || undefined,
    value: Number(r.value),
  })),
  skillCategoryRanks: vm.skillCategoryRanks.map(r => ({ id: r.id, value: Number(r.value) })),
  skillCategorySkillRanks: vm.skillCategorySkillRanks.map(r => ({ id: r.id, value: Number(r.value) })),

  requiredClimates: vm.requiredClimates.length ? vm.requiredClimates.slice() : undefined,

  requiredFeatures: vm.requiredFeatures.length ? asFeatureArray(vm.requiredFeatures) : undefined,
  requiredTerrains: vm.requiredTerrains.length ? asTerrainArray(vm.requiredTerrains) : undefined,
  requiredVegetations: vm.requiredVegetations.length ? asVegetationArray(vm.requiredVegetations) : undefined,
  requiredWaterSources: vm.requiredWaterSources.length ? asWaterBodyArray(vm.requiredWaterSources) : undefined,
});


export default function CultureTypeView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<CultureType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  // reference lists
  const [armours, setArmours] = useState<ArmourType[]>([]);
  const [weapons, setWeapons] = useState<WeaponType[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillgroups, setSkillgroups] = useState<SkillGroup[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [climates, setClimates] = useState<Climate[]>([]);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());
  const [preview, setPreview] = useState<Record<string, boolean>>({});

  const toast = useToast();
  const confirm = useConfirm();

  /* ------------------------------------------------------------------ */
  /* Load data                                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    (async () => {
      try {
        const [tp, at, wt, s, c, g, cl] = await Promise.all([
          fetchCulturetypes(),
          fetchArmourTypes(),
          fetchWeaponTypes(),
          fetchSkills(),
          fetchSkillcategories(),
          fetchSkillgroups(),
          fetchClimates(),
        ]);
        setRows(tp);
        setArmours(at);
        setWeapons(wt);
        setSkills(s);
        setCategories(c);
        setSkillgroups(g);
        setClimates(cl);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ------------------------------------------------------------------ */
  /* Options                                                            */
  /* ------------------------------------------------------------------ */
  const sgNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const sg of skillgroups) m.set(sg.id, sg.name);
    return m;
  }, [skillgroups]);

  const atNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const at of armours) m.set(at.id, at.name);
    return m;
  }, [armours]);

  const wtNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const wt of weapons) m.set(wt.id, wt.name);
    return m;
  }, [weapons]);

  const armourOptions = useMemo(
    () => armours.map(a => ({ value: a.id, label: `${a.name} - (${a.type})` })),
    [armours]
  );
  const weaponOptions = useMemo(
    () => weapons.map(w => ({ value: w.id, label: w.name })),
    [weapons]
  );
  const skillOptions = useMemo(
    () => skills.map(s => ({ value: s.id, label: s.name })),
    [skills]
  );
  const categoryOptions = useMemo(
    () => categories.map(c => ({ value: c.id, label: `(${sgNameById.get(c.group) ?? c.group}) - ${c.name}` })),
    [categories, sgNameById]
  );
  const climateOptions = useMemo(
    () => climates.map(c => ({ value: c.id, label: c.name })),
    [climates]
  );
  const featureOptions = useMemo(
    () => ENVIRONMENT_FEATURES.map(v => ({ value: v, label: v })),
    []
  );
  const terrainOptions = useMemo(
    () => ENVIRONMENT_TERRAINS.map(v => ({ value: v, label: v })),
    []
  );
  const vegetationOptions = useMemo(
    () => ENVIRONMENT_VEGETATIONS.map(v => ({ value: v, label: v })),
    []
  );
  const waterBodyOptions = useMemo(
    () => ENVIRONMENT_WATER_BODIES.map(v => ({ value: v, label: v })),
    []
  );

  /* ------------------------------------------------------------------ */
  /* Validation                                                         */
  /* ------------------------------------------------------------------ */
  const computeErrors = (draft: FormState): FormErrors => {
    const e: typeof errors = {};

    /* -------------------------------------------------- */
    /* Basic fields                                       */
    /* -------------------------------------------------- */
    const id = draft.id.trim();
    if (!id) e.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === id)) e.id = `ID "${id}" already exists`;
    else if (!isValidID(id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;

    const nm = draft.name.trim();
    if (!nm) e.name = 'Name is required';

    const h = draft.hobbySkillRanks.trim();
    if (!h) e.hobbySkillRanks = 'Hobby skill ranks is required';
    else if (!isValidUnsignedInt(h)) e.hobbySkillRanks = 'Must be a non-negative integer';

    /* -------------------------------------------------- */
    /* Preferred weapons/armours                          */
    /* -------------------------------------------------- */
    for (let i = 0; i < draft.preferredArmours.length; i++) {
      const at = draft.preferredArmours[i]?.trim();
      if (!at) { e.preferredArmours = `Preferred Armours[${i + 1}]: armour id required`; break; };
    }

    for (let i = 0; i < draft.preferredWeapons.length; i++) {
      const wt = draft.preferredWeapons[i]?.trim();
      if (!wt) { e.preferredWeapons = `Preferred Weapons[${i + 1}]: weapon id required`; break; };
    }

    /* -------------------------------------------------- */
    /* Skill ranks                                        */
    /* -------------------------------------------------- */
    for (let i = 0; i < draft.skillRanks.length; i++) {
      const r = draft.skillRanks[i];
      if (!r) continue;
      if (!r.id) { e.skillRanks = `SkillRanks[${i + 1}]: skill id required`; break; }
      if (!isValidUnsignedInt((r.value ?? '').trim())) { e.skillRanks = `SkillRanks[${i + 1}]: value must be integer`; break; }
    }

    for (let i = 0; i < draft.skillCategoryRanks.length; i++) {
      const r = draft.skillCategoryRanks[i];
      if (!r) continue;
      if (!r.id) { e.skillCategoryRanks = `CategoryRanks[${i + 1}]: category id required`; break; }
      if (!isValidUnsignedInt((r.value ?? '').trim())) { e.skillCategoryRanks = `CategoryRanks[${i + 1}]: value must be integer`; break; }
    }

    for (let i = 0; i < draft.skillCategorySkillRanks.length; i++) {
      const r = draft.skillCategorySkillRanks[i];
      if (!r) continue;
      if (!r.id) { e.skillCategorySkillRanks = `CategorySkillRanks[${i + 1}]: category id required`; break; }
      if (!isValidUnsignedInt((r.value ?? '').trim())) { e.skillCategorySkillRanks = `CategorySkillRanks[${i + 1}]: value must be integer`; break; }
    }

    /* ----------------------------------------------------- */
    /* Climates/Features/Terrains/Vegetations/Water Sources  */
    /* ----------------------------------------------------- */
    for (let i = 0; i < draft.requiredClimates.length; i++) {
      const c = draft.requiredClimates[i]?.trim();
      if (!c) { e.requiredClimates = `Required Climates[${i + 1}]: climate id required`; break; };
    }

    for (let i = 0; i < draft.requiredFeatures.length; i++) {
      const f = draft.requiredFeatures[i]?.trim();
      if (!f) { e.requiredFeatures = `Required Features[${i + 1}]: feature id required`; break; };
    }

    for (let i = 0; i < draft.requiredTerrains.length; i++) {
      const t = draft.requiredTerrains[i]?.trim();
      if (!t) { e.requiredTerrains = `Required Terrains[${i + 1}]: terrain id required`; break; };
    }

    for (let i = 0; i < draft.requiredVegetations.length; i++) {
      const v = draft.requiredVegetations[i]?.trim();
      if (!v) { e.requiredVegetations = `Required Vegetations[${i + 1}]: vegetation id required`; break; };
    }

    for (let i = 0; i < draft.requiredWaterSources.length; i++) {
      const w = draft.requiredWaterSources[i]?.trim();
      if (!w) { e.requiredWaterSources = `Required Water Sources[${i + 1}]: water source id required`; break; };
    }

    return e;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing]);

  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */
  const columns: ColumnDef<CultureType>[] = useMemo(() => {
    return [
      { id: 'id', header: 'ID', accessor: r => r.id, minWidth: 260 },
      { id: 'name', header: 'Name', accessor: r => r.name, minWidth: 200 },
      { id: 'hobby', header: 'Hobby Ranks', accessor: r => r.hobbySkillRanks, minWidth: 120 },
      {
        id: 'weapons',
        header: 'Preferred Weapons',
        minWidth: 180,
        accessor: r => r.preferredWeapons.map(id => wtNameById.get(id) ?? id).join(', '),
        render: r => (<PillList values={r.preferredWeapons} getLabel={id => wtNameById.get(id) ?? id} />),
      },
      {
        id: 'armours', header: 'Preferred Armours', minWidth: 180,
        accessor: r => r.preferredArmours.map(id => atNameById.get(id) ?? id).join(', '),
        render: r => (<PillList values={r.preferredArmours} getLabel={id => atNameById.get(id) ?? id} />),
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
            <button onClick={() => onDelete(row)} style={{ color: '#b00020' }}>Delete</button>
          </>
        ),
      },
    ];
  }, [rows, atNameById, wtNameById]);

  const globalFilter = (r: CultureType, q: string) => {
    const s = q.toLowerCase();
    return [
      r.id, r.name, r.hobbySkillRanks,
      (r.description ?? ''), (r.characterConcepts ?? ''), (r.clothing ?? ''),
    ].some(v => String(v ?? '').toLowerCase().includes(s));
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

  const startView = (row: CultureType) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: CultureType) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: CultureType) => {
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

      await upsertCulturetype(payload, opts);

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
        description: `Culture Type "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: CultureType) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Culture Type',
      body: `Delete "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter((r) => r.id !== row.id));

    try {
      await deleteCulturetype(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Culture Type "${row.id}" deleted.` });
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

  // Long text preview toggles
  const renderHtmlField = (label: string, key: keyof FormState, rowsCount = 6) => {
    const p = viewing ? true : !!preview[key as string];
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h4 style={{ margin: '8px 0' }}>{label}</h4>
          {!viewing && (
            <button type="button" onClick={() => setPreview(s => ({ ...s, [key as string]: !p }))}>
              {p ? 'Edit' : 'Preview'}
            </button>
          )}
        </div>
        {p ? (
          <MarkupPreview
            content={String(form[key] ?? '')}
            emptyHint={`No ${label.toLowerCase()}`}
            className="preview-html"
            style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}
          />
        ) : (
          <label style={{ display: 'grid', gap: 6 }}>
            <textarea
              value={String(form[key] ?? '')}
              onChange={(e) => setForm(s => ({ ...s, [key]: e.target.value }))}
              disabled={viewing}
              rows={rowsCount}
            />
          </label>
        )}
      </div>
    );
  };

  return (
    <>
      <h2>Culture Types</h2>

      {!showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={startNew}>New Culture Type</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search culture types…"
            aria-label="Search culture types"
          />

          {/* Reset and auto-fit column widths */}
          <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
          <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
        </div>
      )}

      {showForm && (
        <div className="form-container">
          {/* Simple overlay while submitting */}
          {submitting && (<div className="overlay"><Spinner size={24} /> <span>Saving…</span> </div>)}

          <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`}>
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Culture Type</h3>

            {/* Basics */}
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
                onChange={(v) => setForm(s => ({ ...s, name: v }))}
                disabled={viewing}
                error={viewing ? undefined : errors.name}
              />
              <LabeledInput
                label="Hobby Skill Ranks"
                value={form.hobbySkillRanks}
                onChange={makeUnsignedIntOnChange<typeof form>('hobbySkillRanks', setForm)}
                disabled={viewing}
                width={160}
                inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
                error={viewing ? undefined : errors.hobbySkillRanks}
              />
            </div>

            {/* Long text fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              {renderHtmlField('Description', 'description', 6)}
              {renderHtmlField('Character Concepts', 'characterConcepts', 6)}
              {renderHtmlField('Clothing', 'clothing', 5)}
              {renderHtmlField('Aspirations', 'aspirations', 5)}
              {renderHtmlField('Fears', 'fears', 5)}
              {renderHtmlField('Marriage Patterns', 'marriagePatterns', 4)}
              {renderHtmlField('Prejudices', 'prejudices', 5)}
              {renderHtmlField('Religious Beliefs', 'religiousBeliefs', 6)}
            </div>

            {/* Preferred Armours / Weapons */}
            <section style={{ marginTop: 12 }}>
              <IdListEditor
                title="Preferred Armours"
                addButtonLabel='+ Add armour'
                rows={form.preferredArmours}
                onChangeRows={(next) => setForm((s) => ({ ...s, preferredArmours: next }))}
                options={armourOptions}
                loading={loading}
                viewing={viewing}
                columnLabel="Armour"
                error={errors.preferredArmours}
              />

              <IdListEditor
                title="Preferred Weapons"
                addButtonLabel='+ Add weapon'
                rows={form.preferredWeapons}
                onChangeRows={(next) => setForm((s) => ({ ...s, preferredWeapons: next }))}
                options={weaponOptions}
                loading={loading}
                viewing={viewing}
                columnLabel="Weapon"
                error={errors.preferredWeapons}
              />
            </section>

            {/* Skill Ranks */}
            <SkillValueListEditor
              title="Skill Ranks"
              addButtonLabel='+ Add skill rank'
              rows={form.skillRanks}
              onChangeRows={(next) => setForm((s) => ({ ...s, skillRanks: next }))}
              idOptions={skillOptions}
              loading={loading}
              viewing={viewing}
              error={errors.skillRanks}
              signedValues={false}
            />

            {/* Category Ranks */}
            <IdValueListEditor
              title="Skill Category Ranks"
              addButtonLabel='+ Add skill category rank'
              rows={form.skillCategoryRanks}
              onChangeRows={(next) => setForm((s) => ({ ...s, skillCategoryRanks: next }))}
              options={categoryOptions}
              loading={loading}
              viewing={viewing}
              error={errors.skillCategoryRanks}
              signedValues={false}
            />

            {/* Category Skill Ranks */}
            <IdValueListEditor
              title="Skill Category Skill Ranks"
              addButtonLabel='+ Add skill category skill rank'
              rows={form.skillCategorySkillRanks}
              onChangeRows={(next) => setForm((s) => ({ ...s, skillCategorySkillRanks: next }))}
              options={categoryOptions}
              loading={loading}
              viewing={viewing}
              error={errors.skillCategorySkillRanks}
              signedValues={false}
            />

            {/* Requirements */}
            <section style={{ marginTop: 12 }}>
              <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                {/* Climates */}
                <IdListEditor
                  title="Required Climates"
                  addButtonLabel='+ Add climate'
                  rows={form.requiredClimates}
                  onChangeRows={(next) => setForm((s) => ({ ...s, requiredClimates: next }))}
                  options={climateOptions}
                  loading={loading}
                  viewing={viewing}
                  columnLabel="Climate"
                  error={errors.requiredClimates}
                />

                {/* Features/Terrains/Vegetations/Water */}
                <IdListEditor<string>
                  title="Required Features"
                  addButtonLabel='+ Add feature'
                  rows={form.requiredFeatures}
                  onChangeRows={(next) => setForm((s) => ({ ...s, requiredFeatures: next }))}
                  options={featureOptions}
                  viewing={viewing}
                  columnLabel="Feature"
                  error={errors.requiredFeatures}
                />

                <IdListEditor<string>
                  title="Required Terrains"
                  addButtonLabel='+ Add terrain'
                  rows={form.requiredTerrains}
                  onChangeRows={(next) => setForm((s) => ({ ...s, requiredTerrains: next }))}
                  options={terrainOptions}
                  viewing={viewing}
                  columnLabel="Terrain"
                  error={errors.requiredTerrains}
                />

                <IdListEditor<string>
                  title="Required Vegetations"
                  addButtonLabel='+ Add vegetation'
                  rows={form.requiredVegetations}
                  onChangeRows={(next) => setForm((s) => ({ ...s, requiredVegetations: next }))}
                  options={vegetationOptions}
                  viewing={viewing}
                  columnLabel="Vegetation"
                  error={errors.requiredVegetations}
                />

                <IdListEditor<string>
                  title="Required Water Sources"
                  addButtonLabel='+ Add water source'
                  rows={form.requiredWaterSources}
                  onChangeRows={(next) => setForm((s) => ({ ...s, requiredWaterSources: next }))}
                  options={waterBodyOptions}
                  viewing={viewing}
                  columnLabel="Water Source"
                  error={errors.requiredWaterSources}
                />

              </div>
            </section>

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
        <DataTable<CultureType>
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
          persistKey="dt.culturetype.v1"
          ariaLabel="Culture types"
        />
      )}
    </>
  );
}