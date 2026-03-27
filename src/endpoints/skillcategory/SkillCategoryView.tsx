import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchSkillCategories, upsertSkillCategory, deleteSkillCategory,
  fetchSkillGroups,
  fetchSkillProgressionTypes,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  CheckboxInput,
  LabeledInput,
  LabeledSelect,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  SkillCategory,
  SkillProgressionType,
  SkillGroup,
} from '../../types';

import {
  STATS, type Stat,
} from '../../types/enum';

import {
  isValidID, makeIDOnChange,
} from '../../utils';

const prefix = 'SKILLCATEGORY_';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */
type FormState = {
  id: string;
  group: string;                 // stores SkillGroup.id
  name: string;
  useRealmStats: boolean;
  skillProgression: string;      // stores SPT id
  categoryProgression: string;   // stores SPT id
  stat1: Stat | '';
  stat2: Stat | '';
  stat3: Stat | '';
};

type FormErrors = {
  id?: string;
  group?: string;
  name?: string;
  skillProgression?: string;
  categoryProgression?: string;
  stats?: string;
};

const emptyVM = (): FormState => ({
  id: prefix,
  group: '',
  name: '',
  useRealmStats: false,
  skillProgression: '',
  categoryProgression: '',
  stat1: '',
  stat2: '',
  stat3: '',
});

const toVM = (x: SkillCategory): FormState => ({
  id: x.id,
  group: x.group,
  name: x.name,
  useRealmStats: x.useRealmStats,
  skillProgression: x.skillProgression,
  categoryProgression: x.categoryProgression,
  stat1: x.stats[0] ?? '',
  stat2: x.stats[1] ?? '',
  stat3: x.stats[2] ?? '',
});

const fromVM = (vm: FormState): SkillCategory => {
  const stats: Stat[] = [];
  if (vm.stat1) stats.push(vm.stat1);
  if (vm.stat2) stats.push(vm.stat2);
  if (vm.stat3) stats.push(vm.stat3);
  return {
    id: vm.id.trim(),
    group: vm.group.trim(),
    name: vm.name.trim(),
    useRealmStats: !!vm.useRealmStats,
    skillProgression: vm.skillProgression.trim(),
    categoryProgression: vm.categoryProgression.trim(),
    stats,
  };
};

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */

export default function SkillCategoryView() {
  const dtRef = useRef<DataTableHandle>(null);
  // data
  const [rows, setRows] = useState<SkillCategory[]>([]);
  const [spts, setSpts] = useState<SkillProgressionType[]>([]);
  const [groups, setGroups] = useState<SkillGroup[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  // table
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());

  const toast = useToast();
  const confirm = useConfirm();

  /* ------------------------------------------------------------------ */
  /* Load data                                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    (async () => {
      try {
        const [sc, g, spt] = await Promise.all([
          fetchSkillCategories(),
          fetchSkillGroups(),
          fetchSkillProgressionTypes(),
        ]);
        setRows(sc);
        setGroups(g);
        setSpts(spt);
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

  const sptNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of spts) m.set(s.id, s.name);
    return m;
  }, [spts]);

  const sptOptions = useMemo(
    () => spts.map((s) => ({ value: s.id, label: `${s.name}` })),
    [spts]
  );

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) m.set(g.id, g.name);
    return m;
  }, [groups]);

  const groupOptions = useMemo(
    () => groups.map((g) => ({ value: g.id, label: `${g.name}` })),
    [groups]
  );

  const skillOptionsByPrefix = useMemo(() => {
    const byPrefix = {
      skill: sptOptions.filter((option) => !option.value.startsWith('SKILLPROGRESSIONTYPE_BD_') && !option.value.startsWith('SKILLPROGRESSIONTYPE_PP_') && !option.value.startsWith('SKILLPROGRESSIONTYPE_CATEGORY_')),
      category: sptOptions.filter((option) => option.value.startsWith('SKILLPROGRESSIONTYPE_CATEGORY_') || option.value.startsWith('SKILLPROGRESSIONTYPE_NONE')),
    };

    return byPrefix;
  }, [sptOptions]);
  /* ------------------------------------------------------------------ */
  /* Validation                                                         */
  /* ------------------------------------------------------------------ */

  function validateProgressions(skillProgId: string, categoryProgId: string): string | null {
    const skillProg = spts.find((s) => s.id === skillProgId);
    const categoryProg = spts.find((s) => s.id === categoryProgId);

    if (!skillProg || !categoryProg) {
      return 'Invalid progression type selected.';
    }

    if (categoryProg.id !== 'SKILLPROGRESSIONTYPE_CATEGORY_STANDARD' && categoryProg.id !== 'SKILLPROGRESSIONTYPE_NONE') {
      return 'Category Progression must be a valid category progression type or "None".';
    }
    if (categoryProg.id === 'SKILLPROGRESSIONTYPE_CATEGORY_STANDARD' && skillProg.id !== 'SKILLPROGRESSIONTYPE_STANDARD') {
      return 'If Category Progression is "Standard", Skill Progression must also be "Standard".';
    }

    return null;
  }

  const computeErrors = (draft: FormState): FormErrors => {
    const e: typeof errors = {};

    // ID: required, unique (on create), valid format (e.g. starts with prefix)
    if (!draft.id.trim()) e.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === draft.id.trim())) e.id = `ID "${draft.id.trim()}" already exists`;
    else if (!isValidID(draft.id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;

    //Group: required, must be valid id from groups
    if (!draft.group.trim()) e.group = 'Group is required';
    else if (!groupNameById.has(draft.group.trim())) e.group = 'Group must be a valid SkillGroup id';

    // Name: required
    if (!draft.name.trim()) e.name = 'Name is required';

    // Progressions: required, must be valid id from spts
    if (!draft.skillProgression.trim()) e.skillProgression = 'Skill progression is required';
    else if (!sptNameById.has(draft.skillProgression.trim())) e.skillProgression = 'Pick a valid progression';

    if (!draft.categoryProgression.trim()) e.categoryProgression = 'Category progression is required';
    else if (!sptNameById.has(draft.categoryProgression.trim())) e.categoryProgression = 'Pick a valid progression';
    else {
      const progressionError = validateProgressions(draft.skillProgression.trim(), draft.categoryProgression.trim());
      if (progressionError) e.categoryProgression = progressionError;
    }

    // stats: allow 0–3, but require at least one? (Adjust if you need exactly three)
    const chosen = [draft.stat1, draft.stat2, draft.stat3].filter(Boolean) as Stat[];
    const statSet = new Set(STATS);
    if (!draft.useRealmStats && chosen.length === 0) e.stats = 'At least one stat is required unless "Use Realm Stats" is checked';
    else if (draft.useRealmStats && chosen.length > 0) e.stats = 'Stats must be empty when "Use Realm Stats" is checked';
    else if (!chosen.every((s) => statSet.has(s))) e.stats = 'Stats must be valid values';

    return e;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing, sptNameById, groupNameById]);

  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */
  const columns: ColumnDef<SkillCategory>[] = useMemo(() => [
    { id: 'id', header: 'ID', accessor: (r) => r.id, sortType: 'string', minWidth: 280 },
    { id: 'name', header: 'Name', accessor: (r) => r.name, sortType: 'string', minWidth: 180 },
    {
      id: 'group',
      header: 'Group',
      accessor: (r) => groupNameById.get(r.group) ?? r.group,
      sortType: 'string',
      minWidth: 260,
      render: (r) => {
        const label = groupNameById.get(r.group);
        return label ? `${label}` : r.group;
      },
    },
    {
      id: 'useRealmStats',
      header: 'Use Realm Stats',
      accessor: (r) => Number(r.useRealmStats),
      sortType: 'number',
      minWidth: 130,
      render: (r) => (r.useRealmStats ? 'Yes' : 'No'),
    },
    {
      id: 'skillProgression',
      header: 'Skill Progression',
      accessor: (r) => sptNameById.get(r.skillProgression) ?? r.skillProgression,
      sortType: 'string',
      minWidth: 180,
      render: (r) => {
        const label = sptNameById.get(r.skillProgression);
        return label ? `${label}` : r.skillProgression;
      },
    },
    {
      id: 'categoryProgression',
      header: 'Category Progression',
      accessor: (r) => sptNameById.get(r.categoryProgression) ?? r.categoryProgression,
      sortType: 'string',
      minWidth: 180,
      render: (r) => {
        const label = sptNameById.get(r.categoryProgression);
        return label ? `${label}` : r.categoryProgression;
      },
    },
    {
      id: 'stats',
      header: 'Stats',
      accessor: (r) => r.stats.join(','),
      sortType: 'string',
      minWidth: 260,
      render: (r) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {r.stats.map((s, i) => (
            <span key={`${s}-${i}`} style={{
              display: 'inline-block', padding: '2px 8px',
              borderRadius: 999, fontSize: 12,
              border: '1px solid var(--border)', background: 'var(--panel)',
            }}>{s}</span>
          ))}
        </div>
      ),
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
    // re-memoize when names arrive
  ], [groupNameById, sptNameById]);

  const globalFilter = (r: SkillCategory, q: string) => {
    const s = q.toLowerCase();
    const gLabel = groupNameById.get(r.group) ?? '';
    const spLabel = sptNameById.get(r.skillProgression) ?? '';
    const cpLabel = sptNameById.get(r.categoryProgression) ?? '';
    return [
      r.id, r.name, r.group, gLabel,
      r.skillProgression, spLabel,
      r.categoryProgression, cpLabel,
      r.stats.join(','),
      r.useRealmStats ? 'yes' : 'no',
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

  const startView = (row: SkillCategory) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: SkillCategory) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: SkillCategory) => {
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

      await upsertSkillCategory(payload, opts);

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
        description: `Skill Category "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: SkillCategory) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Skill Category',
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
      await deleteSkillCategory(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Skill Category "${row.id}" deleted.` });
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
      <h2>Skill Categories</h2>

      {/* Toolbar hidden while form visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={startNew}>New Skill Category</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skill categories…"
            aria-label="Search skill categories"
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
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Skill Category</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <LabeledInput label="ID" value={form.id} onChange={makeIDOnChange<typeof form>('id', setForm, prefix)} disabled={!!editingId || viewing} error={errors.id} />
              <LabeledInput label="Name" value={form.name} onChange={(v) => setForm(s => ({ ...s, name: v }))} disabled={viewing} error={errors.name} />

              <LabeledSelect
                label="Group"
                value={form.group}
                onChange={(v) => setForm((s) => ({ ...s, group: v }))}
                options={groupOptions}
                disabled={loading || viewing}
                error={viewing ? undefined : errors.group}
                helperText={loading ? 'Loading groups…' : undefined}
              />

              {/* If using Realm stats then individuals may not be selected */}
              <CheckboxInput
                label="Use Realm Stats"
                checked={form.useRealmStats}
                onChange={(c) => setForm((s) => ({ ...s, useRealmStats: c, stat1: c ? '' : s.stat1, stat2: c ? '' : s.stat2, stat3: c ? '' : s.stat3 }))}
                disabled={viewing}
              />

              <LabeledSelect
                label="Skill Progression"
                value={form.skillProgression}
                onChange={(v) => setForm((s) => ({ ...s, skillProgression: v }))}
                options={skillOptionsByPrefix.skill}
                disabled={loading || viewing}
                error={viewing ? undefined : errors.skillProgression}
                helperText={loading ? 'Loading progression types…' : undefined}
              />

              <LabeledSelect
                label="Category Progression"
                value={form.categoryProgression}
                onChange={(v) => setForm((s) => ({ ...s, categoryProgression: v }))}
                options={skillOptionsByPrefix.category}
                disabled={loading || viewing}
                error={viewing ? undefined : errors.categoryProgression}
                helperText={loading ? 'Loading progression types…' : undefined}
              />

              {/* Stats (3 slots, allow duplicates & order) unless using Realm Stats */}
              {!form.useRealmStats && (
                <>
                  <LabeledSelect
                    label="Stat #1"
                    value={form.stat1}
                    onChange={(v) => setForm((s) => ({ ...s, stat1: (v as Stat) || '' }))}
                    options={STATS}
                    disabled={viewing}
                    error={viewing ? undefined : errors.stats}
                  />
                  <LabeledSelect
                    label="Stat #2"
                    value={form.stat2}
                    onChange={(v) => setForm((s) => ({ ...s, stat2: (v as Stat) || '' }))}
                    options={STATS}
                    disabled={viewing}
                    error={undefined}
                  />
                  <LabeledSelect
                    label="Stat #3"
                    value={form.stat3}
                    onChange={(v) => setForm((s) => ({ ...s, stat3: (v as Stat) || '' }))}
                    options={STATS}
                    disabled={viewing}
                    error={undefined}
                  />
                </>
              )}
            </div>

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

      {/* Table hidden while form is visible */}
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
          persistKey="dt.skillcategory.v1"
          ariaLabel="Skill categories"
        />
      )}

      {/* Empty dataset */}
      {!rows.length && !showForm && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No skill categories found.
        </div>
      )}    </>
  );
}