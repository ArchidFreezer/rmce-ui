import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import { LabeledInput, LabeledSelect } from '../../components/inputs';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

import { fetchCreaturePaces, upsertCreaturePace, deleteCreaturePace } from '../../api/creaturepace';
import type { CreaturePace } from '../../types/creaturepace';
import { MANOEUVRE_DIFFICULTIES, type ManoeuvreDifficulty } from '../../types/enum';
import { isValidID } from '../../components/inputs/validators';

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

// ------------------------
// Helpers for scientific-notation input
// ------------------------
const SCI_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
function isScientificNumberString(s: string): boolean {
  return SCI_RE.test(s);
}
function sanitizeScientificInput(s: string): string {
  // Keep digits, '.', 'e'/'E', '+'/'-', and make sure only one 'e' and sign placement is sensible.
  // For UX: allow imperfect intermediate states; rely on final validation.
  return s.replace(/[^0-9eE+.\-]/g, '');
}

export default function CreaturePaceView() {
  const [rows, setRows] = useState<CreaturePace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());

  const toast = useToast();
  const confirm = useConfirm();

  // ---- Load ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchCreaturePaces();
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

  // ---- Validation ----
  const isDifficulty = (s: string): s is ManoeuvreDifficulty => (MANOEUVRE_DIFFICULTIES as readonly string[]).includes(s);
  const [errors, setErrors] = useState<{
    id?: string | undefined;
    name?: string | undefined;
    exhaustionMultiplier?: string | undefined;
    movementMultiplier?: string | undefined;
    manoeuvreDifficulty?: string | undefined;
  }>({});
  const hasErrors = Boolean(errors.id || errors.name || errors.exhaustionMultiplier || errors.movementMultiplier || errors.manoeuvreDifficulty);
  const computeErrors = (draft: FormState, isEditing: boolean) => {
    if (viewing) return {};             // suppress inline errors in view mode

    const next: typeof errors = {};
    // ID validation: non-empty, uppercase letters/numbers/underscores only, must start with "CREATUREPACE_", must be unique (create only)
    if (!draft.id.trim()) next.id = 'ID is required';
    else if (!isEditing && rows.some(r => r.id === draft.id.trim())) next.id = `ID "${draft.id.trim()}" already exists`;
    else if (!isValidID(draft.id, 'CREATUREPACE_')) next.id = 'ID must start with "CREATUREPACE_" and contain additional characters';
    // Name validation: non-empty, allow any chars (including spaces), but trim whitespace
    if (!draft.name.trim()) next.name = 'Name is required';
    // Exhaustion and movement multipliers: required, must be valid numbers (supporting scientific notation)
    const ex = draft.exhaustionMultiplier.trim();
    if (!ex) next.exhaustionMultiplier = 'Exhaustion multiplier is required';
    else if (!isScientificNumberString(ex)) next.exhaustionMultiplier = 'Must be a number (supports scientific notation)';
    else if (!Number.isFinite(Number(ex))) next.exhaustionMultiplier = 'Invalid number';
    // Manoeuvre difficulty: required, must be one of the predefined difficulties
    const mv = draft.movementMultiplier.trim();
    if (!mv) next.movementMultiplier = 'Movement multiplier is required';
    else if (!isScientificNumberString(mv)) next.movementMultiplier = 'Must be a number (supports scientific notation)';
    else if (!Number.isFinite(Number(mv))) next.movementMultiplier = 'Invalid number';
    // Manoeuvre difficulty: required, must be one of the predefined difficulties
    if (!draft.manoeuvreDifficulty.trim()) next.manoeuvreDifficulty = 'Manoeuvre difficulty is required';
    else if (!isDifficulty(draft.manoeuvreDifficulty)) next.manoeuvreDifficulty = 'Invalid manoeuvre difficulty';

    return next;
  };

  useEffect(() => {
    if (!showForm) return;
    if (viewing) return;             // suppress inline errors in view mode
    const isEditing = Boolean(editingId);
    setErrors(computeErrors(form, isEditing));
  }, [form, showForm, viewing]);

  // ----- Handlers (Create / Edit / Delete) -----
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
    vm.id = prefix; // Reset ID to force user to enter a new one, since it must be unique
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
    const isEditing = Boolean(editingId);
    const nextErrors = computeErrors(form, isEditing);
    setErrors(nextErrors);
    const topError = nextErrors.id || nextErrors.name || nextErrors.exhaustionMultiplier || nextErrors.movementMultiplier || nextErrors.manoeuvreDifficulty || '';
    if (topError) return;

    const payload = fromVM(form);
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
        description: `Creature pace "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
      });
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Save failed',
        description: String(err instanceof Error ? err.message : err),
      });
    }
  };

  const onDelete = async (row: CreaturePace) => {
    const ok = await confirm({
      title: 'Delete Creature Pace',
      body: `Delete creature pace "${row.id}"? This cannot be undone.`,
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
      toast({ variant: 'success', title: 'Deleted', description: `Creature pace "${row.id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  // ---- Table ----
  const columns: ColumnDef<CreaturePace>[] = useMemo(() => [
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
      width: 300,
      render: (row) => (
        <>
          <button onClick={() => startView(row)} style={{ marginRight: 6 }}>View</button>
          <button onClick={() => startEdit(row)} style={{ marginRight: 6 }}>Edit</button>
          <button onClick={() => startDuplicate(row)} style={{ marginRight: 6 }}>Duplicate</button>
          <button onClick={() => onDelete(row)} style={{ color: '#b00020' }}>Delete</button>
        </>
      ),
    },
  ], [rows, editingId]); // columns here don’t depend on external label maps

  // ----- Search -----
  const globalFilter = (r: CreaturePace, q: string) => {
    const s = q.toLowerCase();
    return [
      r.id, r.name, r.manoeuvreDifficulty,
      r.exhaustionMultiplier, r.movementMultiplier,
    ].some(v => String(v ?? '').toLowerCase().includes(s));
  };

  // ----- Render -----
  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Creature Paces</h2>

      {/* Form panel */}
      {showForm && (
        <div
          className={`form-panel ${viewing ? 'form-panel--view' : ''}`}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}
        >
          <h3 style={{ marginTop: 0 }}>
            {viewing ? 'View Creature Pace' : (editingId ? 'Edit Creature Pace' : 'New Creature Pace')}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput
              label="ID"
              value={form.id}
              onChange={(v) => setForm(s => ({ ...s, id: v }))}
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
              onChange={(v) => setForm(s => ({ ...s, exhaustionMultiplier: sanitizeScientificInput(v) }))}
              disabled={viewing}
              inputProps={{ inputMode: 'decimal', pattern: '^[+\\-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+\\-]?\\d+)?$' }}
              error={viewing ? undefined : errors.exhaustionMultiplier}
            />

            <LabeledInput
              label="Movement Multiplier"
              value={form.movementMultiplier}
              onChange={(v) => setForm(s => ({ ...s, movementMultiplier: sanitizeScientificInput(v) }))}
              disabled={viewing}
              inputProps={{ inputMode: 'decimal', pattern: '^[+\\-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+\\-]?\\d+)?$' }}
              error={viewing ? undefined : errors.movementMultiplier}
            />

            <LabeledSelect
              label="Manoeuvre Difficulty"
              value={form.manoeuvreDifficulty}
              onChange={(v) => setForm(s => ({ ...s, manoeuvreDifficulty: v as ManoeuvreDifficulty }))}
              options={MANOEUVRE_DIFFICULTIES}
              disabled={viewing}
              error={viewing ? undefined : errors.manoeuvreDifficulty}
              helperText="Pick one (or type your own if your select allows it elsewhere)."
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!viewing && <button onClick={saveForm} disabled={hasErrors}>Save</button>}
            <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {/* Shared DataTable */}
      {!showForm && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
            <button onClick={startNew}>New Creature Pace</button>
            <DataTableSearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search creature paces…"
              aria-label="Search creature paces"
            />
          </div>

          <DataTable<CreaturePace>
            rows={rows}
            columns={columns}
            rowId={(r) => r.id}
            initialSort={{ colId: 'movementMultiplier', dir: 'asc' }}
            searchQuery={query}
            globalFilter={globalFilter}
            mode="client"
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20, 50, 100]}
            tableMinWidth={900}
            zebra
            hover
            resizable
            persistKey="dt.creaturepace.v1"
            ariaLabel="Creature paces"
          />
        </>
      )}
      {!rows.length && !showForm && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No creature paces found.
        </div>
      )}
    </>
  );
}