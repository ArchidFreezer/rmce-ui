import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchCultures, upsertCulture, deleteCulture,
  fetchCultureTypes,
  fetchLanguages,
  fetchProfessions,
  fetchSkillCategories,
  fetchTrainingPackages,
  fetchSkills,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  CheckboxInput,
  IdListEditor,
  IdValueListEditor,
  LabeledInput,
  LabeledSelect,
  LanguageRankListEditor, type LanguageRankRowVM,
  MarkupPreview,
  SkillListEditor,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  Culture,
  CultureType,
  Language,
  Profession,
  Skill,
  SkillCategory,
  TrainingPackage,
} from '../../types';

import {
  isValidID, makeIDOnChange,
} from '../../utils';

const prefix = 'CULTURE_';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */

type HobbySkillVM = { id: string; subcategory?: string | undefined };
type TrainingPackageModifierVM = { id: string; value: string };

type FormState = {
  id: string;
  name: string;
  description: string;

  cultureType: string;
  highCulture: boolean;

  backgroundLanguages: LanguageRankRowVM[];

  hobbySkills: HobbySkillVM[];
  hobbyCategories: string[];

  preferredProfessions: string[];
  restrictedProfessions: string[];

  trainingPackageModifiers: TrainingPackageModifierVM[];
};

type FormErrors = {
  id?: string | undefined;
  name?: string | undefined;
  cultureType?: string | undefined;

  backgroundLanguages?: string | undefined;
  hobbySkills?: string | undefined;
  hobbyCategories?: string | undefined;
  preferredProfessions?: string | undefined;
  restrictedProfessions?: string | undefined;
  trainingPackageModifiers?: string | undefined;
};

const emptyVM = (): FormState => ({
  id: prefix,
  name: '',
  description: '',

  cultureType: '',
  highCulture: false,

  backgroundLanguages: [],

  hobbySkills: [],
  hobbyCategories: [],

  preferredProfessions: [],
  restrictedProfessions: [],

  trainingPackageModifiers: [],
});

const toVM = (x: Culture): FormState => ({
  id: x.id,
  name: x.name,
  description: x.description ?? '',

  cultureType: x.cultureType,
  highCulture: !!x.highCulture,

  backgroundLanguages: (x.backgroundLanguages ?? []).map((bl) => ({
    language: bl.language,
    spoken: bl.spoken != null ? String(bl.spoken) : '',
    written: bl.written != null ? String(bl.written) : '',
    somatic: bl.somatic != null ? String(bl.somatic) : undefined,
  })),

  hobbySkills: (x.hobbySkills ?? []).map((s) => ({
    id: s.id,
    subcategory: s.subcategory,
  })),

  hobbyCategories: x.hobbyCategories ?? [],

  preferredProfessions: x.preferredProfessions ?? [],
  restrictedProfessions: x.restrictedProfessions ?? [],

  trainingPackageModifiers: (x.trainingPackageModifiers ?? []).map((m) => ({
    id: m.id,
    value: String(m.value),
  })),
});

const fromVM = (vm: FormState): Culture => ({
  id: vm.id.trim(),
  name: vm.name.trim(),
  description: vm.description.trim() || undefined,

  cultureType: vm.cultureType,
  highCulture: !!vm.highCulture,

  backgroundLanguages: vm.backgroundLanguages.map((bl) => ({
    language: bl.language,
    spoken: bl.spoken ? Number(bl.spoken) : undefined,
    written: bl.written ? Number(bl.written) : undefined,
    somatic: bl.somatic ? Number(bl.somatic) : undefined,
  })),

  hobbySkills: vm.hobbySkills.map((s) => ({
    id: s.id,
    subcategory: s.subcategory?.trim() || undefined,
  })),

  hobbyCategories: vm.hobbyCategories.slice(),

  preferredProfessions: vm.preferredProfessions.slice(),
  restrictedProfessions: vm.restrictedProfessions.slice(),

  trainingPackageModifiers: vm.trainingPackageModifiers.map((m) => ({
    id: m.id,
    value: Number(m.value),
  })),
});

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */

export default function CultureView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<Culture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  const [cultureTypes, setCultureTypes] = useState<CultureType[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [trainingPackages, setTrainingPackages] = useState<TrainingPackage[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

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
        const [cultures, ct, l, p, c, tp, s] = await Promise.all([
          fetchCultures(),
          fetchCultureTypes(),
          fetchLanguages(),
          fetchProfessions(),
          fetchSkillCategories(),
          fetchTrainingPackages(),
          fetchSkills(),
        ]);
        setRows(cultures);
        setCultureTypes(ct);
        setLanguages(l);
        setProfessions(p);
        setCategories(c);
        setTrainingPackages(tp);
        setSkills(s);
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

  const cultureTypeOptions = useMemo(
    () => cultureTypes.map((ct) => ({ value: ct.id, label: ct.name })),
    [cultureTypes],
  );

  const cultureTypeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const ct of cultureTypes) m.set(ct.id, ct.name);
    return m;
  }, [cultureTypes]);

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

  const professionOptions = useMemo(
    () => professions.map((p) => ({ value: p.id, label: p.name })),
    [professions],
  );

  const trainingPackageOptions = useMemo(
    () => trainingPackages.map((tp) => ({ value: tp.id, label: tp.name })),
    [trainingPackages],
  );

  /* ------------------------------------------------------------------ */
  /* Validation                                                          */
  /* ------------------------------------------------------------------ */

  const computeErrors = (draft: FormState): FormErrors => {
    const e: FormErrors = {};

    const id = draft.id.trim();
    const name = draft.name.trim();

    if (!id) e.id = 'ID is required';
    else if (!editingId && rows.some((r) => r.id === id)) e.id = `ID "${id}" already exists`;
    else if (!isValidID(id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;

    if (!name) e.name = 'Name is required';

    if (!draft.cultureType) e.cultureType = 'Culture Type is required';

    for (let i = 0; i < draft.backgroundLanguages.length; i++) {
      const bl = draft.backgroundLanguages[i];
      if (!bl) continue;
      if (!bl.language) {
        e.backgroundLanguages = `Background Language ${i + 1}: language is required`;
        break;
      }
    }

    for (let i = 0; i < draft.hobbySkills.length; i++) {
      const s = draft.hobbySkills[i];
      if (!s) continue;
      if (!s.id) {
        e.hobbySkills = `Hobby Skill ${i + 1}: skill is required`;
        break;
      }
    }

    if (draft.hobbyCategories.some((c) => !c)) {
      e.hobbyCategories = 'Hobby categories contain empty values';
    }

    if (draft.preferredProfessions.some((p) => !p)) {
      e.preferredProfessions = 'Preferred professions contain empty values';
    }

    if (draft.restrictedProfessions.some((p) => !p)) {
      e.restrictedProfessions = 'Restricted professions contain empty values';
    }

    for (let i = 0; i < draft.trainingPackageModifiers.length; i++) {
      const m = draft.trainingPackageModifiers[i];
      if (!m) continue;
      if (!m.id) {
        e.trainingPackageModifiers = `Training Package Modifier ${i + 1}: training package is required`;
        break;
      }
      if (m.value === '' || isNaN(Number(m.value))) {
        e.trainingPackageModifiers = `Training Package Modifier ${i + 1}: value must be a number`;
        break;
      }
    }

    return e;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, showForm, viewing]);

  /* ------------------------------------------------------------------ */
  /* Table columns                                                      */
  /* ------------------------------------------------------------------ */

  const columns: ColumnDef<Culture>[] = [
    { id: 'id', header: 'ID', accessor: (r) => r.id, minWidth: 260 },
    { id: 'name', header: 'Name', accessor: (r) => r.name, minWidth: 180 },
    {
      id: 'cultureType',
      header: 'Culture Type',
      accessor: (r) => cultureTypeNameById.get(r.cultureType) ?? r.cultureType,
      sortType: 'string',
      minWidth: 180,
      render: (r) => {
        const label = cultureTypeNameById.get(r.cultureType);
        return label ? label : r.cultureType;
      },
    },
    {
      id: 'highCulture',
      header: 'High Culture',
      accessor: (r) => (r.highCulture ? 'Yes' : 'No'),
      minWidth: 100,
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

  const globalFilter = (r: Culture, q: string) =>
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

  const startView = (row: Culture) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: Culture) => {
    setForm(toVM(row));
    setEditingId(row.id);
    setViewing(false);
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: Culture) => {
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
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };

      await upsertCulture(payload, opts);

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
        description: `Culture "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: Culture) => {
    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Culture',
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
      await deleteCulture(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Culture "${row.id}" deleted.` });
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

  /* ------------------------------------------------------------------ */
  /* Render                                                            */
  /* ------------------------------------------------------------------ */

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <>
      <h2>Cultures</h2>

      {!showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={startNew}>New Culture</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cultures…"
            aria-label="Search cultures"
          />
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
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Culture</h3>

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
                label="Culture Type"
                value={form.cultureType}
                onChange={(v) => setForm((s) => ({ ...s, cultureType: v }))}
                options={cultureTypeOptions}
                disabled={viewing}
                error={viewing ? undefined : errors.cultureType}
              />
              <CheckboxInput
                label="High Culture"
                checked={form.highCulture}
                onChange={(c) => setForm((s) => ({ ...s, highCulture: c }))}
                disabled={viewing}
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

            {/* Background Languages */}
            <LanguageRankListEditor
              title="Background Languages"
              rows={form.backgroundLanguages}
              onChangeRows={(next) => setForm((s) => ({ ...s, backgroundLanguages: next }))}
              languageOptions={languageOptions}
              loading={loading}
              viewing={viewing}
              error={viewing ? undefined : errors.backgroundLanguages}
              showSomatic
              addButtonLabel="+ Add language"
            />

            {/* Hobby Skills */}
            <SkillListEditor
              title="Hobby Skills"
              rows={form.hobbySkills}
              onChangeRows={(next) => setForm((s) => ({ ...s, hobbySkills: next }))}
              idOptions={skillOptions}
              idColumnLabel="Skill"
              addButtonLabel="+ Add hobby skill"
              viewing={viewing}
              error={viewing ? undefined : errors.hobbySkills}
            />

            {/* Hobby Categories */}
            <IdListEditor
              title="Hobby Categories"
              rows={form.hobbyCategories}
              onChangeRows={(next) => setForm((s) => ({ ...s, hobbyCategories: next }))}
              options={categoryOptions}
              columnLabel="Category"
              addButtonLabel="+ Add hobby category"
              viewing={viewing}
              error={viewing ? undefined : errors.hobbyCategories}
            />

            {/* Preferred Professions */}
            <IdListEditor
              title="Preferred Professions"
              rows={form.preferredProfessions}
              onChangeRows={(next) => setForm((s) => ({ ...s, preferredProfessions: next }))}
              options={professionOptions}
              columnLabel="Profession"
              addButtonLabel="+ Add preferred profession"
              viewing={viewing}
              error={viewing ? undefined : errors.preferredProfessions}
            />

            {/* Restricted Professions */}
            <IdListEditor
              title="Restricted Professions"
              rows={form.restrictedProfessions}
              onChangeRows={(next) => setForm((s) => ({ ...s, restrictedProfessions: next }))}
              options={professionOptions}
              columnLabel="Profession"
              addButtonLabel="+ Add restricted profession"
              viewing={viewing}
              error={viewing ? undefined : errors.restrictedProfessions}
            />

            {/* Training Package Modifiers */}
            <IdValueListEditor
              title="Training Package Modifiers"
              rows={form.trainingPackageModifiers}
              onChangeRows={(next) => setForm((s) => ({ ...s, trainingPackageModifiers: next }))}
              options={trainingPackageOptions}
              idColumnLabel="Training Package"
              valueColumnLabel="Modifier"
              addButtonLabel="+ Add modifier"
              viewing={viewing}
              error={viewing ? undefined : errors.trainingPackageModifiers}
              signedValues
            />

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
                  {Object.entries(errors).map(([field, error]) =>
                    error ? <li key={field}>{error}</li> : null,
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
          initialSort={{ colId: 'name', dir: 'asc' }}
          searchQuery={query}
          globalFilter={globalFilter}
          mode="client"
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          tableMinWidth={0}
          persistKey="dt.cultures.v1"
          ariaLabel="Culture data"
        />
      )}
    </>
  );
}
