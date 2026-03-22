import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DataTable,
  DataTableSearchInput,
  type ColumnDef,
  type DataTableHandle,
} from '../../components/DataTable';
import { LabeledInput } from '../../components/inputs/LabeledInput';
import { LabeledSelect } from '../../components/inputs/LabeledSelect';
import { HtmlPreview } from '../../components/inputs/HtmlPreview';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

import { fetchCulturetypes, upsertCulturetype, deleteCulturetype, asFeatureArray, asTerrainArray, asVegetationArray, asWaterBodyArray } from '../../api/culturetype';

import { fetchArmourTypes } from '../../api/armourtype'; // assumes you have these
import { fetchWeaponTypes } from '../../api/weapontype';
import { fetchSkills } from '../../api/skill';
import { fetchSkillcategories } from '../../api/skillcategory';
import { fetchClimates } from '../../api/climate';

import type { CultureType } from '../../types/culturetype';
import type { ArmourType } from '../../types/armourtype';
import type { WeaponType } from '../../types/weapontype';
import type { Skill } from '../../types/skill';
import type { SkillCategory } from '../../types/skillcategory';
import type { Climate } from '../../types/climate';

import {
  ENVIRONMENT_FEATURES,         // string[]
  ENVIRONMENT_TERRAINS,         // string[]
  ENVIRONMENT_VEGETATIONS,      // string[]
  ENVIRONMENT_WATER_BODIES,     // string[]
} from '../../types/enum';

import { isValidID, makeIDOnChange } from '../../utils/inputHelpers';

const prefix = 'CULTURETYPE_';

// ---------- Form VM (strings for numbers while typing) ----------
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

// helpers
const INT_RE = /^\d+$/;
const sanitizeInt = (s: string) => s.replace(/[^\d]/g, '');

export default function CultureTypeView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<CultureType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // reference lists
  const [armours, setArmours] = useState<ArmourType[]>([]);
  const [weapons, setWeapons] = useState<WeaponType[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [climates, setClimates] = useState<Climate[]>([]);

  const [armourLoading, setArmourLoading] = useState(true);
  const [weaponLoading, setWeaponLoading] = useState(true);
  const [skillLoading, setSkillLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [climateLoading, setClimateLoading] = useState(true);

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
  }>({});

  const toast = useToast();
  const confirm = useConfirm();

  const [preview, setPreview] = useState<Record<string, boolean>>({});

  // Load list
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchCulturetypes();
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

  // Load references
  useEffect(() => {
    let mounted = true;
    (async () => {
      try { const list = await fetchArmourTypes(); if (mounted) setArmours(list); }
      finally { if (mounted) setArmourLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try { const list = await fetchWeaponTypes(); if (mounted) setWeapons(list); }
      finally { if (mounted) setWeaponLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try { const list = await fetchSkills(); if (mounted) setSkills(list); }
      finally { if (mounted) setSkillLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try { const list = await fetchSkillcategories(); if (mounted) setCategories(list); }
      finally { if (mounted) setCategoryLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try { const list = await fetchClimates(); if (mounted) setClimates(list); }
      finally { if (mounted) setClimateLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  // Option lists
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
    () => categories.map(c => ({ value: c.id, label: c.name })),
    [categories]
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

  // Validation
  const computeErrors = (draft = form) => {
    const e: typeof errors = {};

    const id = draft.id.trim();
    const nm = draft.name.trim();
    if (!id) e.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === id)) e.id = `ID "${id}" already exists`;
    else if (!isValidID(id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;

    if (!nm) e.name = 'Name is required';

    const h = draft.hobbySkillRanks.trim();
    if (!h) e.hobbySkillRanks = 'Hobby skill ranks is required';
    else if (!INT_RE.test(h)) e.hobbySkillRanks = 'Must be a non-negative integer';

    // skill ranks: id present, value int
    for (let i = 0; i < draft.skillRanks.length; i++) {
      const r = draft.skillRanks[i];
      if (!r) continue;
      if (!r.id) { e.skillRanks = `SkillRanks[${i + 1}]: skill id required`; break; }
      if (!INT_RE.test((r.value ?? '').trim())) { e.skillRanks = `SkillRanks[${i + 1}]: value must be integer`; break; }
    }
    for (let i = 0; i < draft.skillCategoryRanks.length; i++) {
      const r = draft.skillCategoryRanks[i];
      if (!r) continue;
      if (!r.id) { e.skillCategoryRanks = `CategoryRanks[${i + 1}]: category id required`; break; }
      if (!INT_RE.test((r.value ?? '').trim())) { e.skillCategoryRanks = `CategoryRanks[${i + 1}]: value must be integer`; break; }
    }
    for (let i = 0; i < draft.skillCategorySkillRanks.length; i++) {
      const r = draft.skillCategorySkillRanks[i];
      if (!r) continue;
      if (!r.id) { e.skillCategorySkillRanks = `CategorySkillRanks[${i + 1}]: category id required`; break; }
      if (!INT_RE.test((r.value ?? '').trim())) { e.skillCategorySkillRanks = `CategorySkillRanks[${i + 1}]: value must be integer`; break; }
    }

    return e;
  };

  const hasErrors = Boolean(Object.values(errors).some(Boolean));

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors());
  }, [form, showForm, viewing, rows]);

  // Actions
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
    vm.name = vm.name ? `${vm.name} (Copy)` : vm.name;
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
      await upsertCulturetype(payload, opts);

      setRows(prev => {
        if (isEditing) {
          const idx = prev.findIndex(r => r.id === payload.id);
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
        description: `Culture type "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
      });
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Save failed',
        description: String(err instanceof Error ? err.message : err),
      });
    }
  };

  const onDelete = async (row: CultureType) => {
    const ok = await confirm({
      title: 'Delete Culture Type',
      body: `Delete "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter(r => r.id !== row.id));
    try {
      await deleteCulturetype(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Culture type "${row.id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  // Table
  const columns: ColumnDef<CultureType>[] = useMemo(() => [
    { id: 'id', header: 'ID', accessor: r => r.id, sortType: 'string', minWidth: 260 },
    { id: 'name', header: 'Name', accessor: r => r.name, sortType: 'string', minWidth: 200 },
    { id: 'hobby', header: 'Hobby Ranks', accessor: r => r.hobbySkillRanks, sortType: 'number', align: 'right', minWidth: 120 },
    { id: 'weapons', header: 'Preferred Weapons', accessor: r => r.preferredWeapons.length, sortType: 'number', align: 'right', minWidth: 180 },
    { id: 'armours', header: 'Preferred Armours', accessor: r => r.preferredArmours.length, sortType: 'number', align: 'right', minWidth: 180 },
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
  ], []);

  const globalFilter = (r: CultureType, q: string) => {
    const s = q.toLowerCase();
    return [
      r.id, r.name, r.hobbySkillRanks,
      (r.description ?? ''), (r.characterConcepts ?? ''), (r.clothing ?? ''),
    ].some(v => String(v ?? '').toLowerCase().includes(s));
  };

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  // Reusable helpers for array editors
  const addIdTo = (key: keyof FormState, value: string) =>
    setForm(s => ({ ...s, [key]: [...(s[key] as string[]), value] }));
  const removeIndexFrom = (key: keyof FormState, i: number) =>
    setForm(s => {
      const copy = [...(s[key] as string[])];
      copy.splice(i, 1);
      return { ...s, [key]: copy };
    });
  const updateIndexOf = (key: keyof FormState, i: number, value: string) =>
    setForm(s => {
      const copy = [...(s[key] as string[])];
      copy[i] = value;
      return { ...s, [key]: copy };
    });

  // Long text preview toggles

  const renderHtmlField = (label: string, key: keyof FormState, rowsCount = 6) => {
    const p = !!preview[key as string];
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h4 style={{ margin: '8px 0' }}>{label}</h4>
          <button type="button" onClick={() => setPreview(s => ({ ...s, [key as string]: !p }))}>
            {p ? 'Edit' : 'Preview'}
          </button>
        </div>
        {p ? (
          <HtmlPreview
            html={String(form[key] ?? '')}
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

  const updateSkillRankAt = (
    index: number,
    patch: Partial<SkillRankVM>
  ) => {
    setForm((s) => {
      const copy = s.skillRanks.slice();

      if (index < 0 || index >= copy.length) return s;
      const current = copy[index];
      if (!current) return s;

      copy[index] = {
        id: patch.id ?? current.id,
        subcategory:
          patch.subcategory !== undefined ? patch.subcategory : current.subcategory,
        value: patch.value ?? current.value,
      };

      return { ...s, skillRanks: copy };
    });
  };

  const updateCategoryRankAt = (
    key: 'skillCategoryRanks' | 'skillCategorySkillRanks',
    index: number,
    patch: Partial<CategoryRankVM>
  ) => {
    setForm((s) => {
      const copy = s[key].slice();

      if (index < 0 || index >= copy.length) return s;
      const current = copy[index];
      if (!current) return s;

      copy[index] = {
        id: patch.id ?? current.id,
        value: patch.value ?? current.value,
      };

      return { ...s, [key]: copy };
    });
  };

  return (
    <>
      <h2>Culture Types</h2>

      {!showForm && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
          <button onClick={startNew}>New Culture Type</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search culture types…"
            aria-label="Search culture types"
          />
          <button
            type="button"
            onClick={() => dtRef.current?.resetColumnWidths()}
            title="Reset all column widths"
            style={{ marginLeft: 'auto' }}
          >
            Reset column widths
          </button>
        </div>
      )}

      {showForm && (
        <div
          className={`form-panel ${viewing ? 'form-panel--view' : ''}`}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}
        >
          <h3 style={{ marginTop: 0 }}>
            {viewing ? 'View Culture Type' : (editingId ? 'Edit Culture Type' : 'New Culture Type')}
          </h3>

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
              onChange={(v) => setForm(s => ({ ...s, hobbySkillRanks: sanitizeInt(v) }))}
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
            <h4 style={{ margin: '8px 0' }}>Preferred Armours</h4>
            {!viewing && (
              <button type="button" onClick={() => addIdTo('preferredArmours', '')} style={{ marginBottom: 8 }}>
                + Add armour
              </button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              {form.preferredArmours.map((id, i) => (
                <React.Fragment key={`pa-${i}`}>
                  <LabeledSelect
                    label="Armour"
                    hideLabel
                    value={id}
                    onChange={(v) => updateIndexOf('preferredArmours', i, v)}
                    options={armourOptions}
                    disabled={armourLoading || viewing}
                  />
                  {!viewing && (
                    <button type="button" onClick={() => removeIndexFrom('preferredArmours', i)} style={{ color: '#b00020' }}>
                      Remove
                    </button>
                  )}
                </React.Fragment>
              ))}
            </div>

            <h4 style={{ margin: '16px 0 8px' }}>Preferred Weapons</h4>
            {!viewing && (
              <button type="button" onClick={() => addIdTo('preferredWeapons', '')} style={{ marginBottom: 8 }}>
                + Add weapon
              </button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              {form.preferredWeapons.map((id, i) => (
                <React.Fragment key={`pw-${i}`}>
                  <LabeledSelect
                    label="Weapon"
                    hideLabel
                    value={id}
                    onChange={(v) => updateIndexOf('preferredWeapons', i, v)}
                    options={weaponOptions}
                    disabled={weaponLoading || viewing}
                  />
                  {!viewing && (
                    <button type="button" onClick={() => removeIndexFrom('preferredWeapons', i)} style={{ color: '#b00020' }}>
                      Remove
                    </button>
                  )}
                </React.Fragment>
              ))}
            </div>
          </section>

          {/* Skill Ranks */}
          <section style={{ marginTop: 12 }}>
            <h4 style={{ margin: '8px 0' }}>Skill Ranks</h4>
            {!viewing && (
              <button type="button" onClick={() =>
                setForm(s => ({ ...s, skillRanks: [...s.skillRanks, { id: '', subcategory: '', value: '' }] }))
              } style={{ marginBottom: 8 }}>
                + Add skill rank
              </button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 1fr 120px auto', gap: 8 }}>
              <div style={{ fontWeight: 600 }}>Skill</div>
              <div style={{ fontWeight: 600 }}>Subcategory (optional)</div>
              <div style={{ fontWeight: 600 }}>Value</div>
              <div />
              {form.skillRanks.map((r, i) => (
                <React.Fragment key={`sr-${i}`}>
                  <LabeledSelect
                    label="Skill"
                    hideLabel
                    value={r.id}
                    onChange={(v) => updateSkillRankAt(i, { id: v })}
                    options={skillOptions}
                    disabled={skillLoading || viewing}
                  />
                  <LabeledInput
                    label="Subcategory"
                    hideLabel
                    value={r.subcategory ?? ''}
                    onChange={(v) => updateSkillRankAt(i, { subcategory: v || undefined })}
                    disabled={viewing}
                  />
                  <LabeledInput
                    label="Value"
                    hideLabel
                    value={r.value}
                    onChange={(v) => updateSkillRankAt(i, { value: sanitizeInt(v) })}
                    disabled={viewing}
                    width={100}
                  />
                  {!viewing && (
                    <button type="button" onClick={() => setForm(s => {
                      const copy = s.skillRanks.slice(); copy.splice(i, 1);
                      return { ...s, skillRanks: copy };
                    })} style={{ color: '#b00020' }}>
                      Remove
                    </button>
                  )}
                </React.Fragment>
              ))}
            </div>
            {errors.skillRanks && <div style={{ color: '#b00020', marginTop: 6 }}>{errors.skillRanks}</div>}
          </section>

          {/* Category Ranks */}
          <section style={{ marginTop: 12 }}>
            <h4 style={{ margin: '8px 0' }}>Skill Category Ranks</h4>
            {!viewing && (
              <button type="button" onClick={() =>
                setForm(s => ({ ...s, skillCategoryRanks: [...s.skillCategoryRanks, { id: '', value: '' }] }))
              } style={{ marginBottom: 8 }}>
                + Add category rank
              </button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 120px auto', gap: 8 }}>
              <div style={{ fontWeight: 600 }}>Category</div>
              <div style={{ fontWeight: 600 }}>Value</div>
              <div />
              {form.skillCategoryRanks.map((r, i) => (
                <React.Fragment key={`scr-${i}`}>
                  <LabeledSelect
                    label="Category"
                    hideLabel
                    value={r.id}
                    onChange={(v) => updateCategoryRankAt('skillCategoryRanks', i, { id: v })}
                    options={categoryOptions}
                    disabled={categoryLoading || viewing}
                  />
                  <LabeledInput
                    label="Value"
                    hideLabel
                    ariaLabel="Value"
                    value={r.value}
                    onChange={(v) => updateCategoryRankAt('skillCategoryRanks', i, { value: sanitizeInt(v) })}
                    disabled={viewing}
                    width={100}
                  />
                  {!viewing && (
                    <button type="button" onClick={() => setForm(s => {
                      const copy = s.skillCategoryRanks.slice(); copy.splice(i, 1);
                      return { ...s, skillCategoryRanks: copy };
                    })} style={{ color: '#b00020' }}>
                      Remove
                    </button>
                  )}
                </React.Fragment>
              ))}
            </div>
            {errors.skillCategoryRanks && <div style={{ color: '#b00020', marginTop: 6 }}>{errors.skillCategoryRanks}</div>}
          </section>

          {/* Category Skill Ranks */}
          <section style={{ marginTop: 12 }}>
            <h4 style={{ margin: '8px 0' }}>Skill Category Skill Ranks</h4>
            {!viewing && (
              <button type="button" onClick={() =>
                setForm(s => ({ ...s, skillCategorySkillRanks: [...s.skillCategorySkillRanks, { id: '', value: '' }] }))
              } style={{ marginBottom: 8 }}>
                + Add category-skill rank
              </button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 120px auto', gap: 8 }}>
              <div style={{ fontWeight: 600 }}>Category</div>
              <div style={{ fontWeight: 600 }}>Value</div>
              <div />
              {form.skillCategorySkillRanks.map((r, i) => (
                <React.Fragment key={`scsr-${i}`}>
                  <LabeledSelect
                    label="Category"
                    hideLabel
                    value={r.id}
                    onChange={(v) => updateCategoryRankAt('skillCategorySkillRanks', i, { id: v })}
                    options={categoryOptions}
                    disabled={categoryLoading || viewing}
                  />
                  <LabeledInput
                    label="Value"
                    hideLabel
                    ariaLabel="Value"
                    value={r.value}
                    onChange={(v) => updateCategoryRankAt('skillCategorySkillRanks', i, { value: sanitizeInt(v) })}
                    disabled={viewing}
                    width={100}
                  />
                  {!viewing && (
                    <button type="button" onClick={() => setForm(s => {
                      const copy = s.skillCategorySkillRanks.slice(); copy.splice(i, 1);
                      return { ...s, skillCategorySkillRanks: copy };
                    })} style={{ color: '#b00020' }}>
                      Remove
                    </button>
                  )}
                </React.Fragment>
              ))}
            </div>
            {errors.skillCategorySkillRanks && <div style={{ color: '#b00020', marginTop: 6 }}>{errors.skillCategorySkillRanks}</div>}
          </section>

          {/* Requirements */}
          <section style={{ marginTop: 12 }}>
            <h4 style={{ margin: '8px 0' }}>Requirements</h4>

            <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              {/* Climates */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <strong>Required Climates</strong>
                  {!viewing && <button type="button" onClick={() => addIdTo('requiredClimates', '')}>+ Add</button>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  {form.requiredClimates.map((id, i) => (
                    <React.Fragment key={`rc-${i}`}>
                      <LabeledSelect
                        label="Climate"
                        hideLabel
                        value={id}
                        onChange={(v) => updateIndexOf('requiredClimates', i, v)}
                        options={climateOptions}
                        disabled={climateLoading || viewing}
                      />
                      {!viewing && (
                        <button type="button" onClick={() => removeIndexFrom('requiredClimates', i)} style={{ color: '#b00020' }}>
                          Remove
                        </button>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Features/Terrains/Vegetations/Water */}
              {[
                { label: 'Required Features', key: 'requiredFeatures', options: featureOptions },
                { label: 'Required Terrains', key: 'requiredTerrains', options: terrainOptions },
                { label: 'Required Vegetations', key: 'requiredVegetations', options: vegetationOptions },
                { label: 'Required Water Sources', key: 'requiredWaterSources', options: waterBodyOptions },
              ].map(({ label, key, options }) => (
                <div key={key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <strong>{label}</strong>
                    {!viewing && <button type="button" onClick={() => addIdTo(key as keyof FormState, '')}>+ Add</button>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                    {(form[key as keyof FormState] as string[]).map((v, i) => (
                      <React.Fragment key={`${key}-${i}`}>
                        <LabeledSelect
                          label={label}
                          hideLabel
                          value={v}
                          onChange={(nv) => updateIndexOf(key as keyof FormState, i, nv)}
                          options={options}
                          disabled={viewing}
                        />
                        {!viewing && (
                          <button type="button" onClick={() => removeIndexFrom(key as keyof FormState, i)} style={{ color: '#b00020' }}>
                            Remove
                          </button>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!viewing && <button onClick={saveForm} disabled={hasErrors}>Save</button>}
            <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {!showForm && (
        <DataTable<CultureType>
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
          persistKey="dt.culturetype.v1"
          ariaLabel="Culture types"
        />
      )}
    </>
  );
}