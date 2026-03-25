import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchCreaturePaces, upsertCreaturePace, deleteCreaturePace,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  LabeledInput,
  LabeledSelect,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  CreaturePace
} from '../../types';

import {
  MANOEUVRE_DIFFICULTIES, ManoeuvreDifficulty
} from '../../types/enum';

import {
  isValidID, makeIDOnChange,
  isValidScientific, makeScientificOnChange,
} from '../../utils';

const prefix = 'CREATUREPACE_';

// ------------------------
// Form VM (strings for numbers while typing)
// ------------------------
type FormState = {
  id: string;
  name: string;
  exhaustionMultiplier: string;  // scientific notation allowed (e.g., "5e1")
  movementMultiplier: string;    // scientific notation allowed (e.g., "6E0")
  manoeuvreDifficulty: ManoeuvreDifficulty;
};

type FormErrors = {
  id?: string;
  name?: string;
  exhaustionMultiplier?: string;
  movementMultiplier?: string;
  manoeuvreDifficulty?: string;
};

function emptyVM(): FormState {
  return { id: prefix, name: '', exhaustionMultiplier: '', movementMultiplier: '', manoeuvreDifficulty: 'Normal' };
}

function toVM(c: CreaturePace): FormState {
  return {
    id: c.id,
    name: c.name,
    exhaustionMultiplier: String(c.exhaustionMultiplier),
    movementMultiplier: String(c.movementMultiplier),
    manoeuvreDifficulty: c.manoeuvreDifficulty,
  };
}

function fromVM(vm: FormState): CreaturePace {
  return {
    id: vm.id.trim(),
    name: vm.name.trim(),
    exhaustionMultiplier: Number(vm.exhaustionMultiplier),
    movementMultiplier: Number(vm.movementMultiplier),
    manoeuvreDifficulty: vm.manoeuvreDifficulty,
  };
}

export default function CreaturePaceView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<CreaturePace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // form state
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
        const [tp] = await Promise.all([
          fetchCreaturePaces(),
        ]);
        setRows(tp);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ------------------------------------------------------------------ */
  /* Validation                                                         */
  /* ------------------------------------------------------------------ */
  const isDifficulty = (s: string): s is ManoeuvreDifficulty => (MANOEUVRE_DIFFICULTIES as readonly string[]).includes(s);

  const computeErrors = (draft: FormState): FormErrors => {
    const next: FormErrors = {};

    // ID validation: non-empty, uppercase letters/numbers/underscores only, must start with "CREATUREPACE_", must be unique (create only)
    if (!draft.id.trim()) next.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === draft.id.trim())) next.id = `ID "${draft.id.trim()}" already exists`;
    else if (!isValidID(draft.id, prefix)) next.id = `ID must start with "${prefix}" and contain additional characters`;

    // Name validation: non-empty, allow any chars (including spaces), but trim whitespace
    if (!draft.name.trim()) next.name = 'Name is required';

    // Exhaustion and movement multipliers: required, must be valid numbers (supporting scientific notation)
    const ex = draft.exhaustionMultiplier.trim();
    if (!ex) next.exhaustionMultiplier = 'Exhaustion multiplier is required';
    else if (!isValidScientific(ex)) next.exhaustionMultiplier = 'Must be a number (supports scientific notation)';
    else if (!Number.isFinite(Number(ex))) next.exhaustionMultiplier = 'Invalid number';

    // Movement multiplier: required, must be valid number (supporting scientific notation)
    const mv = draft.movementMultiplier.trim();
    if (!mv) next.movementMultiplier = 'Movement multiplier is required';
    else if (!isValidScientific(mv)) next.movementMultiplier = 'Must be a number (supports scientific notation)';
    else if (!Number.isFinite(Number(mv))) next.movementMultiplier = 'Invalid number';

    // Manoeuvre difficulty: required, must be one of the predefined difficulties
    if (!draft.manoeuvreDifficulty.trim()) next.manoeuvreDifficulty = 'Manoeuvre difficulty is required';
    else if (!isDifficulty(draft.manoeuvreDifficulty)) next.manoeuvreDifficulty = 'Invalid manoeuvre difficulty';

    return next;
  };

  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */
  const columns: ColumnDef<CreaturePace>[] = [
    { id: 'id', header: 'ID', accessor: (r) => r.id, sortType: 'string', minWidth: 240 },
    { id: 'name', header: 'Name', accessor: (r) => r.name, sortType: 'string', minWidth: 160 },
    {
      id: 'exhaustionMultiplier',
      header: 'Exhaustion Multiplier',
      accessor: (r) => r.exhaustionMultiplier,
      sortType: 'number',
      align: 'center',
      minWidth: 180,
    },
    {
      id: 'movementMultiplier',
      header: 'Movement Multiplier',
      accessor: (r) => r.movementMultiplier,
      sortType: 'number',
      align: 'center',
      minWidth: 80,
    },
    {
      id: 'manoeuvreDifficulty',
      header: 'Manoeuvre Difficulty',
      accessor: (r) => r.manoeuvreDifficulty,
      sortType: 'string',
      minWidth: 180,
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

  // ----- Search -----
  const globalFilter = (r: CreaturePace, q: string) => {
    const s = q.toLowerCase();
    return [
      r.id, r.name, r.manoeuvreDifficulty,
      r.exhaustionMultiplier, r.movementMultiplier,
    ].some(v => String(v ?? '').toLowerCase().includes(s));
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing]); // keep current with form changes for live validation (but skip in view mode)

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

  const startView = (row: CreaturePace) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: CreaturePace) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: CreaturePace) => {
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

      await upsertCreaturePace(payload, opts);

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
        description: `Creature Pace "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: CreaturePace) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Creature Pace',
      body: `Delete "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter((r) => r.id !== row.id));

    try {
      await deleteCreaturePace(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Creature Pace "${row.id}" deleted.` });
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
      <h2>Creature Paces</h2>

      {/* Toolbar shown only when table visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={startNew}>New Creature Pace</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search creature paces…"
            aria-label="Search creature paces"
          />

          {/* Reset and auto-fit column widths */}
          <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
          <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
        </div>
      )}

      {/* Form panel */}
      {showForm && (
        <div className="form-container">
          {/* Simple overlay while submitting */}
          {submitting && (<div className="overlay"><Spinner size={24} /> <span>Saving…</span> </div>)}

          <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`}>
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Creature Pace</h3>

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
                onChange={(v) => setForm(s => ({ ...s, name: v }))}
                disabled={viewing}
                error={viewing ? undefined : errors.name}
              />

              <LabeledInput
                label="Exhaustion Multiplier"
                value={form.exhaustionMultiplier}
                onChange={makeScientificOnChange<typeof form>('exhaustionMultiplier', setForm)}
                disabled={viewing}
                // inputProps={{ inputMode: 'decimal', pattern: '^[+\\-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+\\-]?\\d+)?$' }}
                error={viewing ? undefined : errors.exhaustionMultiplier}
              />

              <LabeledInput
                label="Movement Multiplier"
                value={form.movementMultiplier}
                onChange={makeScientificOnChange<typeof form>('movementMultiplier', setForm)}
                disabled={viewing}
                // inputProps={{ inputMode: 'decimal', pattern: '^[+\\-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+\\-]?\\d+)?$' }}
                error={viewing ? undefined : errors.movementMultiplier}
              />

              <LabeledSelect
                label="Manoeuvre Difficulty"
                value={form.manoeuvreDifficulty}
                onChange={(v) => setForm(s => ({ ...s, manoeuvreDifficulty: v as ManoeuvreDifficulty }))}
                options={MANOEUVRE_DIFFICULTIES}
                disabled={viewing}
                error={viewing ? undefined : errors.manoeuvreDifficulty}
              />
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
            )}          </div>
        </div>
      )}

      {/* Shared DataTable */}
      {!showForm && (
        <DataTable<CreaturePace>
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
          persistKey="dt.creaturepace.v1"
          ariaLabel="Creature paces"
        />
      )}
      {!rows.length && !showForm && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No creature paces found.
        </div>
      )}
    </>
  );
}