import { useEffect, useMemo, useRef, useState } from 'react';
import { DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import { LabeledInput, LabeledSelect, CheckboxInput } from '../../components/inputs';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { isValidID, makeIDOnChange } from '../../utils/inputHelpers';

import { fetchSkillcategories, upsertSkillcategory, deleteSkillcategory } from '../../api/skillcategory';
import { fetchSkillprogressiontypes } from '../../api/skillprogressiontype';
import { fetchSkillgroups } from '../../api/skillgroup';

import type { SkillCategory } from '../../types/skillcategory';
import type { SkillProgressionType } from '../../types/skillprogressiontype';
import type { SkillGroup } from '../../types/skillgroup';
import { STATS, type Stat } from '../../types/enum';

const prefix = 'SKILLCATEGORY_';

/* ------------------------
   Form VM (keep strings; stats as 3 slots to allow duplicates/order)
------------------------- */
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

export default function SkillCategoryView() {
  const dtRef = useRef<DataTableHandle>(null);
  // data
  const [rows, setRows] = useState<SkillCategory[]>([]);
  const [spts, setSpts] = useState<SkillProgressionType[]>([]);
  const [groups, setGroups] = useState<SkillGroup[]>([]);

  // loading/errors
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sptLoading, setSptLoading] = useState(true);
  const [grpLoading, setGrpLoading] = useState(true);

  // table
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());
  const [errors, setErrors] = useState<{
    id?: string | undefined;
    group?: string | undefined;
    name?: string | undefined;
    skillProgression?: string | undefined;
    categoryProgression?: string | undefined;
    stats?: string | undefined;
  }>({});

  const toast = useToast();
  const confirm = useConfirm();

  // ---- load rows
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchSkillcategories();
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

  // ---- load skill progression types
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchSkillprogressiontypes();
        if (!mounted) return;
        setSpts(list);
      } catch (e) {
        console.error('Failed to load skill progression types', e);
      } finally {
        if (mounted) setSptLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ---- load skill groups
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchSkillgroups();
        if (!mounted) return;
        setGroups(list);
      } catch (e) {
        console.error('Failed to load skill groups', e);
      } finally {
        if (mounted) setGrpLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // maps / options
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

  // validation
  const computeErrors = (draft = form) => {
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

    // stats: allow 0–3, but require at least one? (Adjust if you need exactly three)
    const chosen = [draft.stat1, draft.stat2, draft.stat3].filter(Boolean) as Stat[];
    const statSet = new Set(STATS);
    if (!draft.useRealmStats && chosen.length === 0) e.stats = 'At least one stat is required when "Use Realm Stats" is checked';
    else if (draft.useRealmStats && chosen.length > 0) e.stats = 'Stats must be empty when "Use Realm Stats" is checked';
    else if (!chosen.every((s) => statSet.has(s))) e.stats = 'Stats must be valid values';

    return e;
  };

  const hasErrors = Boolean(
    errors.id || errors.group || errors.name || errors.skillProgression || errors.categoryProgression || errors.stats
  );

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors());
  }, [form, showForm, viewing, sptNameById, groupNameById]);

  // actions
  const startNew = () => {
    setViewing(false); setEditingId(null);
    setForm(emptyVM()); setErrors({}); setShowForm(true);
  };
  const startView = (row: SkillCategory) => {
    setViewing(true); setEditingId(row.id);
    setForm(toVM(row)); setErrors({}); setShowForm(true);
  };
  const startEdit = (row: SkillCategory) => {
    setViewing(false); setEditingId(row.id);
    setForm(toVM(row)); setErrors({}); setShowForm(true);
  };
  const startDuplicate = (row: SkillCategory) => {
    setViewing(false); setEditingId(null);
    const vm = toVM(row);
    vm.id = prefix;
    vm.name += ' Copy';
    setForm(vm); setErrors({}); setShowForm(true);
  };
  const cancelForm = () => {
    setShowForm(false); setViewing(false); setEditingId(null); setErrors({});
  };

  const saveForm = async () => {
    const payload = fromVM(form);

    const nextErrors = computeErrors(form);
    setErrors(nextErrors);
    if (hasErrors) return;

    const isEditing = Boolean(editingId);
    try {
      const opts = isEditing
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };
      await upsertSkillcategory(payload, opts);

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

      setShowForm(false); setViewing(false); setEditingId(null);
      toast({ variant: 'success', title: isEditing ? 'Updated' : 'Saved', description: `Skill category "${payload.id}" ${isEditing ? 'updated' : 'created'}.` });
    } catch (err) {
      toast({ variant: 'danger', title: 'Save failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  const onDelete = async (row: SkillCategory) => {
    const id = row?.id;
    if (!id) return;
    const ok = await confirm({
      title: 'Delete Skill Category',
      body: `Delete Skill Category "${id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter(a => a.id !== id));
    try {
      await deleteSkillcategory(id);
      // if currently editing this item, close the form
      if (editingId === row.id) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Skill Category "${id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  // columns / table
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

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Skill Categories</h2>

      {/* Toolbar hidden while form visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
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

      {/* Form panel */}
      {showForm && (
        <div
          className={`form-panel ${viewing ? 'form-panel--view' : ''}`}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}
        >
          <h3 style={{ marginTop: 0 }}>
            {viewing ? 'View Skill Category' : (editingId ? 'Edit Skill Category' : 'New Skill Category')}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput label="ID" value={form.id} onChange={makeIDOnChange<typeof form>('id', setForm, prefix)} disabled={!!editingId || viewing} error={errors.id} />
            <LabeledInput label="Name" value={form.name} onChange={(v) => setForm(s => ({ ...s, name: v }))} disabled={viewing} error={errors.name} />

            <LabeledSelect
              label="Group"
              value={form.group}
              onChange={(v) => setForm((s) => ({ ...s, group: v }))}
              options={groupOptions}
              disabled={grpLoading || viewing}
              error={viewing ? undefined : errors.group}
              helperText={grpLoading ? 'Loading groups…' : 'Select a SkillGroup id'}
            />

            <CheckboxInput
              label="Use Realm Stats"
              checked={form.useRealmStats}
              onChange={(c) => setForm((s) => ({ ...s, useRealmStats: c }))}
              disabled={viewing}
            />

            <LabeledSelect
              label="Skill Progression"
              value={form.skillProgression}
              onChange={(v) => setForm((s) => ({ ...s, skillProgression: v }))}
              options={sptOptions}
              disabled={sptLoading || viewing}
              error={viewing ? undefined : errors.skillProgression}
              helperText={sptLoading ? 'Loading progression types…' : 'Select a SkillProgressionType id'}
            />

            <LabeledSelect
              label="Category Progression"
              value={form.categoryProgression}
              onChange={(v) => setForm((s) => ({ ...s, categoryProgression: v }))}
              options={sptOptions}
              disabled={sptLoading || viewing}
              error={viewing ? undefined : errors.categoryProgression}
              helperText={sptLoading ? 'Loading progression types…' : 'Select a SkillProgressionType id'}
            />

            {/* Stats (3 slots, allow duplicates & order) */}
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
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!viewing && <button onClick={saveForm} disabled={hasErrors}>Save</button>}
            <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {/* Table hidden while form is visible */}
      {!showForm && (
        <DataTable<SkillCategory>
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
          tableMinWidth={0}
          zebra
          hover
          resizable
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