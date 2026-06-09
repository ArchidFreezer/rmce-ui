import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchForagables,
  upsertForagable,
  deleteForagable,
  fetchClimates,
} from '../../api';

import {
  CheckboxGroup,
  DataTable,
  type DataTableHandle,
  DataTableSearchInput,
  type ColumnDef,
  IdListEditor,
  LabeledInput,
  LabeledSelect,
  MarkupPreview,
  PillList,
  Spinner,
  useConfirm,
  useToast,
} from '../../components';

import type {
  Climate,
  Foragable,
} from '../../types';

import {
  ENVIRONMENT_FEATURES,
  ENVIRONMENT_TERRAINS,
  ENVIRONMENT_VEGETATIONS,
  ENVIRONMENT_WATER_BODIES,
  FORAGABLE_EFFECT_TYPES,
  FORAGABLE_PREPARATION_TYPES,
  MANOEUVRE_DIFFICULTIES,
  type EnvironmentFeature,
  type EnvironmentTerrain,
  type EnvironmentVegetation,
  type EnvironmentWaterBody,
  type ForagableEffectType,
  type ForagablePreparationType,
  type ManoeuvreDifficulty,
} from '../../types/enum';

import {
  isValidID,
  isValidUnsignedInt,
  makeIDOnChange,
  sanitizeUnsignedInt,
} from '../../utils';

const prefix = 'FORAGABLE_';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */

type FormState = {
  id: string;
  name: string;
  effectType: ForagableEffectType;
  form: string;
  difficulty: ManoeuvreDifficulty;
  preparationType: ForagablePreparationType;
  addictionFactor: string;
  cost: string;
  locationFeatures: EnvironmentFeature[];
  locationTerrains: EnvironmentTerrain[];
  locationVegetation: EnvironmentVegetation[];
  locationWaterSources: EnvironmentWaterBody[];
  locationClimates: string[];
  effect: string;
};

type FormErrors = {
  id?: string | undefined;
  name?: string | undefined;
  effectType?: string | undefined;
  difficulty?: string | undefined;
  preparationType?: string | undefined;
  addictionFactor?: string | undefined;
};

const emptyVM = (): FormState => ({
  id: prefix,
  name: '',
  effectType: 'General Purpose',
  form: '',
  difficulty: 'Medium',
  preparationType: 'Ingest',
  addictionFactor: '0',
  cost: '',
  locationFeatures: [],
  locationTerrains: [],
  locationVegetation: [],
  locationWaterSources: [],
  locationClimates: [],
  effect: '',
});

const toVM = (x: Foragable): FormState => ({
  id: x.id,
  name: x.name,
  effectType: x.effectType,
  form: x.form ?? '',
  difficulty: x.difficulty,
  preparationType: x.preparationType,
  addictionFactor: String(x.addictionFactor),
  cost: x.cost ?? '',
  locationFeatures: x.location?.features ?? [],
  locationTerrains: x.location?.terrains ?? [],
  locationVegetation: x.location?.vegetation ?? [],
  locationWaterSources: x.location?.waterSources ?? [],
  locationClimates: x.location?.climates ?? [],
  effect: x.effect ?? '',
});

const fromVM = (vm: FormState): Foragable => {
  const hasLocation =
    vm.locationFeatures.length > 0 ||
    vm.locationTerrains.length > 0 ||
    vm.locationVegetation.length > 0 ||
    vm.locationWaterSources.length > 0 ||
    vm.locationClimates.length > 0;

  return {
    id: vm.id.trim(),
    name: vm.name.trim(),
    effectType: vm.effectType,
    form: vm.form.trim() || undefined,
    difficulty: vm.difficulty,
    preparationType: vm.preparationType,
    addictionFactor: Number(vm.addictionFactor),
    cost: vm.cost.trim() || undefined,
    location: hasLocation
      ? {
        features: vm.locationFeatures.slice(),
        terrains: vm.locationTerrains.slice(),
        vegetation: vm.locationVegetation.slice(),
        waterSources: vm.locationWaterSources.slice(),
        climates: vm.locationClimates.slice(),
      }
      : undefined,
    effect: vm.effect.trim() || undefined,
  };
};

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */

export default function ForagableView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<Foragable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  const [climates, setClimates] = useState<Climate[]>([]);

  const [query, setQuery] = useState('');
  const [effectTypeFilter, setEffectTypeFilter] = useState<ForagableEffectType | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());

  const [previewEffect, setPreviewEffect] = useState(false);

  const toast = useToast();
  const confirm = useConfirm();

  /* ------------------------------------------------------------------ */
  /* Load data                                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    (async () => {
      try {
        const [foragables, climateRows] = await Promise.all([
          fetchForagables(),
          fetchClimates(),
        ]);
        setRows(foragables);
        setClimates(climateRows);
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

  const climateNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of climates) map.set(row.id, row.name);
    return map;
  }, [climates]);

  const climateOptions = useMemo(
    () => climates.map((row) => ({ value: row.id, label: row.name })),
    [climates],
  );

  const effectTypeOptions = useMemo(
    () => FORAGABLE_EFFECT_TYPES.map((value) => ({ value, label: value })),
    [],
  );
  const difficultyOptions = useMemo(
    () => MANOEUVRE_DIFFICULTIES.map((value) => ({ value, label: value })),
    [],
  );
  const preparationTypeOptions = useMemo(
    () => FORAGABLE_PREPARATION_TYPES.map((value) => ({ value, label: value })),
    [],
  );
  const featureOptions = useMemo(() => ENVIRONMENT_FEATURES.map((value) => ({ value, label: value })), []);
  const terrainOptions = useMemo(() => ENVIRONMENT_TERRAINS.map((value) => ({ value, label: value })), []);
  const vegetationOptions = useMemo(() => ENVIRONMENT_VEGETATIONS.map((value) => ({ value, label: value })), []);
  const waterBodyOptions = useMemo(() => ENVIRONMENT_WATER_BODIES.map((value) => ({ value, label: value })), []);

  /* ------------------------------------------------------------------ */
  /* Validation                                                         */
  /* ------------------------------------------------------------------ */

  const computeErrors = (draft: FormState): FormErrors => {
    const next: FormErrors = {};

    const id = draft.id.trim();
    if (!id) next.id = 'ID is required';
    else if (!editingId && rows.some((row) => row.id === id)) next.id = `ID "${id}" already exists`;
    else if (!isValidID(id, prefix)) next.id = `ID must start with "${prefix}" and contain additional characters`;

    if (!draft.name.trim()) next.name = 'Name is required';

    if (!draft.effectType) next.effectType = 'Effect type is required';
    if (!draft.difficulty) next.difficulty = 'Difficulty is required';
    if (!draft.preparationType) next.preparationType = 'Preparation type is required';

    const af = draft.addictionFactor.trim();
    if (!isValidUnsignedInt(af)) {
      next.addictionFactor = 'Addiction factor must be an integer between 0 and 100';
    } else {
      const n = Number(af);
      if (n > 100) next.addictionFactor = 'Addiction factor must be between 0 and 100';
    }

    return next;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing]);

  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */

  const columns: ColumnDef<Foragable>[] = useMemo(() => [
    { id: 'id', header: 'ID', accessor: (row) => row.id, sortType: 'string', minWidth: 260 },
    { id: 'name', header: 'Name', accessor: (row) => row.name, sortType: 'string', minWidth: 180 },
    { id: 'effectType', header: 'Effect Type', accessor: (row) => row.effectType, sortType: 'string', minWidth: 200 },
    { id: 'difficulty', header: 'Difficulty', accessor: (row) => row.difficulty, sortType: 'string', minWidth: 120 },
    { id: 'preparationType', header: 'Preparation', accessor: (row) => row.preparationType, sortType: 'string', minWidth: 120 },
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
  ], []);

  const globalFilter = (row: Foragable, q: string) =>
    [row.id, row.name, row.effectType, row.difficulty, row.preparationType, row.effect ?? '']
      .some((value) => String(value).toLowerCase().includes(q.toLowerCase()));

  const filteredRows = useMemo(
    () => rows.filter((row) => !effectTypeFilter || row.effectType === effectTypeFilter),
    [rows, effectTypeFilter],
  );

  const hasActiveFilters = effectTypeFilter !== '';

  useEffect(() => {
    setPage(1);
  }, [effectTypeFilter]);

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

  const startView = (row: Foragable) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: Foragable) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: Foragable) => {
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
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    const payload = fromVM(form);
    const isEditing = Boolean(editingId);

    try {
      const opts = isEditing
        ? { method: 'PUT' as const }
        : { method: 'POST' as const };
      await upsertForagable(payload, opts);

      setRows((prev) => {
        if (isEditing) {
          const index = prev.findIndex((row) => row.id === payload.id);
          if (index >= 0) {
            const copy = prev.slice();
            copy[index] = { ...copy[index], ...payload };
            return copy;
          }
        }
        return [payload, ...prev];
      });

      setShowForm(false);
      setViewing(false);
      setEditingId(null);

      toast({
        variant: 'success',
        title: isEditing ? 'Updated' : 'Saved',
        description: `Foragable "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: Foragable) => {
    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Foragable',
      body: `Delete "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });

    if (!ok) {
      setSubmitting(false);
      return;
    }

    const previous = rows;
    setRows((current) => current.filter((item) => item.id !== row.id));
    setPage(1);

    try {
      await deleteForagable(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Foragable "${row.id}" deleted.` });
    } catch (err) {
      setRows(previous);
      toast({
        variant: 'danger',
        title: 'Delete failed',
        description: String(err instanceof Error ? err.message : err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <>
      <h2>Foragables</h2>

      {!showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={startNew}>New Foragable</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foragables…"
            aria-label="Search foragables"
          />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>Effect Type</span>
            <select
              value={effectTypeFilter}
              onChange={(e) => setEffectTypeFilter(e.target.value as ForagableEffectType | '')}
              aria-label="Filter by effect type"
              style={{ padding: '6px 8px' }}
            >
              <option value="">All</option>
              {FORAGABLE_EFFECT_TYPES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          {hasActiveFilters && (
            <button type="button" onClick={() => setEffectTypeFilter('')}>
              Clear filters
            </button>
          )}
          <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
          <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
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
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Foragable</h3>

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
                onChange={(value) => setForm((state) => ({ ...state, name: value }))}
                disabled={viewing}
                error={viewing ? undefined : errors.name}
              />
              <LabeledSelect
                label="Effect Type"
                value={form.effectType}
                onChange={(value) => setForm((state) => ({ ...state, effectType: value as ForagableEffectType }))}
                options={effectTypeOptions}
                disabled={viewing}
                error={viewing ? undefined : errors.effectType}
              />
              <LabeledInput
                label="Form"
                value={form.form}
                onChange={(value) => setForm((state) => ({ ...state, form: value }))}
                disabled={viewing}
              />
              <LabeledSelect
                label="Difficulty"
                value={form.difficulty}
                onChange={(value) => setForm((state) => ({ ...state, difficulty: value as ManoeuvreDifficulty }))}
                options={difficultyOptions}
                disabled={viewing}
                error={viewing ? undefined : errors.difficulty}
              />
              <LabeledSelect
                label="Preparation Type"
                value={form.preparationType}
                onChange={(value) => setForm((state) => ({ ...state, preparationType: value as ForagablePreparationType }))}
                options={preparationTypeOptions}
                disabled={viewing}
                error={viewing ? undefined : errors.preparationType}
              />
              <LabeledInput
                label="Addiction Factor"
                value={form.addictionFactor}
                onChange={(value) => setForm((state) => ({ ...state, addictionFactor: sanitizeUnsignedInt(value) }))}
                disabled={viewing}
                error={viewing ? undefined : errors.addictionFactor}
                inputProps={{ inputMode: 'numeric', pattern: '\\d*' }}
              />
              <LabeledInput
                label="Cost"
                value={form.cost}
                onChange={(value) => setForm((state) => ({ ...state, cost: value }))}
                disabled={viewing}
              />
            </div>

            {/* Effect */}
            <section style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h4 style={{ margin: '8px 0' }}>Effect</h4>
                {!viewing && (
                  <button type="button" onClick={() => setPreviewEffect((p) => !p)}>
                    {previewEffect ? 'Edit' : 'Preview'}
                  </button>
                )}
              </div>
              {previewEffect || viewing ? (
                <MarkupPreview
                  content={form.effect}
                  emptyHint="No effect"
                  className="preview-html"
                  style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}
                />
              ) : (
                <label style={{ display: 'grid', gap: 6 }}>
                  <textarea
                    value={form.effect}
                    onChange={(e) => setForm((state) => ({ ...state, effect: e.target.value }))}
                    disabled={viewing}
                    rows={3}
                  />
                </label>
              )}
            </section>

            {/* Location */}
            <section style={{ marginTop: 16, display: 'grid', gap: 16 }}>
              <h4 style={{ margin: 0 }}>Location</h4>
              {viewing ? (
                <>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>Climates</span>
                    <PillList
                      values={form.locationClimates}
                      getLabel={(value) => climateNameById.get(value) ?? value}
                      emptyLabel="No climates"
                    />
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>Environment Tags</span>
                    <PillList
                      values={[
                        ...form.locationFeatures.map((value) => `Feature: ${value}`),
                        ...form.locationTerrains.map((value) => `Terrain: ${value}`),
                        ...form.locationVegetation.map((value) => `Vegetation: ${value}`),
                        ...form.locationWaterSources.map((value) => `Water Source: ${value}`),
                      ]}
                      emptyLabel="No environment tags"
                    />
                  </div>
                </>
              ) : (
                <>
                  <IdListEditor
                    title="Climates"
                    rows={form.locationClimates}
                    onChangeRows={(next) => setForm((state) => ({ ...state, locationClimates: next }))}
                    options={climateOptions}
                    columnLabel="Climate"
                    addButtonLabel="+ Add climate"
                    viewing={viewing}
                  />
                  <CheckboxGroup
                    label="Features"
                    value={form.locationFeatures}
                    onChange={(next) => setForm((state) => ({ ...state, locationFeatures: next as EnvironmentFeature[] }))}
                    options={featureOptions}
                    disabled={viewing}
                    columns={2}
                  />
                  <CheckboxGroup
                    label="Terrains"
                    value={form.locationTerrains}
                    onChange={(next) => setForm((state) => ({ ...state, locationTerrains: next as EnvironmentTerrain[] }))}
                    options={terrainOptions}
                    disabled={viewing}
                    columns={2}
                  />
                  <CheckboxGroup
                    label="Vegetation"
                    value={form.locationVegetation}
                    onChange={(next) => setForm((state) => ({ ...state, locationVegetation: next as EnvironmentVegetation[] }))}
                    options={vegetationOptions}
                    disabled={viewing}
                    columns={2}
                  />
                  <CheckboxGroup
                    label="Water Sources"
                    value={form.locationWaterSources}
                    onChange={(next) => setForm((state) => ({ ...state, locationWaterSources: next as EnvironmentWaterBody[] }))}
                    options={waterBodyOptions}
                    disabled={viewing}
                    columns={2}
                  />
                </>
              )}
            </section>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {!viewing && (
                <button onClick={saveForm} disabled={hasErrors || submitting}>
                  {submitting ? 'Submitting…' : 'Save'}
                </button>
              )}
              <button onClick={cancelForm} type="button">
                {viewing ? 'Close' : 'Cancel'}
              </button>
            </div>

            {/* Validation errors */}
            {Object.values(errors).some(Boolean) && (
              <div style={{ marginTop: 12, color: '#b00020' }}>
                <h4 style={{ margin: '0 0 4px' }}>Please fix the following errors:</h4>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {Object.entries(errors).map(([field, message]) =>
                    message ? <li key={field}>{message}</li> : null,
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
          rowId={(row) => row.id}
          initialSort={{ colId: 'name', dir: 'asc' }}
          searchQuery={query}
          globalFilter={globalFilter}
          mode="client"
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          tableMinWidth={0}
          persistKey="dt.foragables.v1"
          ariaLabel="Foragable data"
        />
      )}
    </>
  );
}
