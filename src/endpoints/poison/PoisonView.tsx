import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchPoisons, upsertPoison, deletePoison,
  fetchPoisonTypes,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  LabeledInput,
  LabeledSelect,
  Spinner,
  useConfirm, useToast,
} from '../../components'

import type {
  Poison,
  PoisonType,
} from '../../types';

import {
  isValidID, makeIDOnChange,
  isValidUnsignedInt, makeUnsignedIntOnChange,
} from '../../utils';

const prefix = 'POISON_';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */
type FormState = {
  id: string;
  name: string;
  type: string;
  level: number | '';
  levelVariance: string;
}

type FormErrors = {
  id?: string;
  name?: string;
  type?: string;
  level?: string;
  variance?: string;
}

const emptyVM = (): FormState => ({
  id: prefix,
  name: '',
  type: '',
  level: '',
  levelVariance: '',
});

const toVM = (p: Poison): FormState => ({
  id: p.id,
  name: p.name,
  type: p.type,
  level: p.level,
  levelVariance: p.levelVariance,
});

const fromVM = (vm: FormState): Poison => ({
  id: vm.id.trim(),
  name: vm.name.trim(),
  type: vm.type.trim(),
  level: Number(vm.level),
  levelVariance: vm.levelVariance.trim(),
});

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */

export default function PoisonView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<Poison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  const [poisonTypes, setPoisonTypes] = useState<PoisonType[]>([]);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // form state (Create & Edit)
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
        const [p, pt] = await Promise.all([
          fetchPoisons(),
          fetchPoisonTypes(),

        ]);
        setRows(p);
        setPoisonTypes(pt);
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
  const poisonTypeIds = useMemo(() =>
    new Set(poisonTypes.map(pt => pt.id)),
    [poisonTypes]
  );

  const poisonTypeById = useMemo(() => {
    const m = new Map<string, string>();
    for (const pt of poisonTypes) m.set(pt.id, pt.type);
    return m;
  },
    [poisonTypes]
  );

  const poisonTypeOptions = useMemo(() =>
    poisonTypes.map((pt) => ({ value: pt.id, label: `${pt.type}`, })),
    [poisonTypes]
  );


  /* ------------------------------------------------------------------ */
  /* Validation                                                         */
  /* ------------------------------------------------------------------ */

  const computeErrors = (draft: FormState): FormErrors => {
    const e: FormErrors = {};

    // ID (only on create, must be unique and start with prefix in ucase and contain additional characters)
    if (!draft.id.trim()) e.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === draft.id.trim())) e.id = `ID "${draft.id.trim()}" already exists`;
    else if (!isValidID(draft.id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;

    // Name
    if (!draft.name.trim()) e.name = 'Name is required';

    // Type
    if (!draft.type.trim()) e.type = 'Type is required';
    else if (!poisonTypeIds.has(draft.type.trim())) e.type = `Type "${draft.type.trim()}" is not a valid PoisonType id`;

    // Level (must be a number, but allow empty string for controlled input)
    const raw = (draft.level ?? '').toString().trim();
    if (!isValidUnsignedInt(raw)) e.level = `Level must be an integer`;

    // Variance must be a single uppercase character
    if (!draft.levelVariance.trim()) e.variance = `Level Variance is required`;
    else if (!/^[A-H]$/.test(draft.levelVariance.trim())) e.variance = 'Level Variance must be a single uppercase character between A and H';

    return e;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing]); // keep current for live validation


  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */
  const columns: ColumnDef<Poison>[] = useMemo(() => {
    return [
      { id: 'id', header: 'ID', accessor: (r) => r.id, sortType: 'string', minWidth: 220 },
      { id: 'name', header: 'Name', accessor: (r) => r.name, sortType: 'string', minWidth: 180 },
      { id: 'type', header: 'Type', accessor: (r) => r.type, sortType: 'string', render: (r) => poisonTypeById.get(r.type) ?? r.type, minWidth: 180 },
      { id: 'level', header: 'Level', accessor: r => r.level, sortType: 'number', align: 'center', minWidth: 80 },
      { id: 'levelVariance', header: 'Level Variance', accessor: r => r.levelVariance, sortType: 'string', align: 'center', minWidth: 120 },
      {
        id: 'actions', header: 'Actions', sortable: false, width: 160,
        render: (row) => (
          <>
            <button onClick={() => startView(row)} style={{ marginRight: 6 }}>View</button>
            <button onClick={() => startEdit(row)} style={{ marginRight: 6 }}>Edit</button>
            <button onClick={() => startDuplicate(row)} style={{ marginRight: 6 }}>Duplicate</button>
            <button onClick={() => onDelete(row)} style={{ color: '#b00020' }}>Delete</button>
          </>
        ),
      },
    ];
  }, [rows, poisonTypeById]);

  // ----- Search -----
  const globalFilter = (p: Poison, q: string) => {
    const s = q.toLowerCase();
    return [p.id, p.name, poisonTypeById.get(p.type) ?? p.type, p.level, p.levelVariance]
      .some(v => String(v ?? '').toLowerCase().includes(s));
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

  const startView = (row: Poison) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: Poison) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: Poison) => {
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

      await upsertPoison(payload, opts);

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
        description: `Poison "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: Poison) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Poison',
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
      await deletePoison(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Poison "${row.id}" deleted.` });
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
      <h2>Poisons</h2>

      {/* Toolbar hidden while form visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={startNew}>New Poison</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search poisons…"
            aria-label="Search poisons"
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
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Poison</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <LabeledInput label="ID" value={form.id} onChange={makeIDOnChange<typeof form>('id', setForm, prefix)} disabled={!!editingId || viewing} error={errors.id} />
              <LabeledInput label="Name" value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} error={errors.name} disabled={viewing} />

              <LabeledSelect
                label="Type"
                value={form.type}
                onChange={(v) => setForm(s => ({ ...s, type: v }))}
                options={poisonTypeOptions}
                disabled={loading || viewing}
                error={viewing ? undefined : errors.type}
                helperText={loading ? 'Loading Poison Types…' : undefined}
              />

              <LabeledInput label="Level" value={String(form.level).trim()} disabled={viewing}
                onChange={makeUnsignedIntOnChange<typeof form>('level', setForm)}
                inputProps={{ inputMode: 'numeric', pattern: '\\d*', }} // mobile numeric keypad
                error={errors.level}
              />

              <LabeledInput label="Level Variance" value={form.levelVariance} onChange={(v) => setForm((s) => ({ ...s, levelVariance: v }))} error={errors.variance} disabled={viewing} />
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

      {/* Shared DataTable */}
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
          persistKey="dt.poisons.v1"
          ariaLabel='Poisons data'
        />
      )}
      {!rows.length && !showForm && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No poisons found.
        </div>
      )}
    </>
  );
}

