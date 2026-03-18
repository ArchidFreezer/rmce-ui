import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import { LabeledInput } from '../../components/inputs';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { isIntegerString, isValidID } from '../../components/inputs/validators';
import { sanitizeUnsignedInt } from '../../components/inputs/sanitisers';

import {
  fetchSkillprogressiontypes,
  upsertSkillprogressiontype,
  deleteSkillprogressiontype,
} from '../../api/skillprogressiontype';
import type { SkillProgressionType } from '../../types/skillprogressiontype';

const prefix = 'SKILLPROGRESSIONTYPE_';

/* ------------------------
   Form VM (use strings for number inputs while typing)
------------------------- */
type FormState = {
  id: string;
  name: string;
  zero: string;
  ten: string;
  twenty: string;
  thirty: string;
  remaining: string;
};

const emptyVM = (): FormState => ({
  id: prefix,
  name: '',
  zero: '',
  ten: '',
  twenty: '',
  thirty: '',
  remaining: '',
});

const toVM = (x: SkillProgressionType): FormState => ({
  id: x.id,
  name: x.name,
  zero: String(x.zero),
  ten: String(x.ten),
  twenty: String(x.twenty),
  thirty: String(x.thirty),
  remaining: String(x.remaining),
});

const fromVM = (vm: FormState): SkillProgressionType => ({
  id: vm.id.trim(),
  name: vm.name.trim(),
  zero: Number(vm.zero),
  ten: Number(vm.ten),
  twenty: Number(vm.twenty),
  thirty: Number(vm.thirty),
  remaining: Number(vm.remaining),
});



export default function SkillProgressionTypeView() {
  const [rows, setRows] = useState<SkillProgressionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    zero?: string | undefined;
    ten?: string | undefined;
    twenty?: string | undefined;
    thirty?: string | undefined;
    remaining?: string | undefined;
  }>({});

  const toast = useToast();
  const confirm = useConfirm();

  /* ---- Load ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchSkillprogressiontypes();
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

  /* ---- Validation ---- */
  const computeErrors = (draft = form) => {
    const e: typeof errors = {};
    if (!draft.id.trim()) e.id = 'ID is required';
    else if (!isValidID(draft.id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;
    if (!draft.name.trim()) e.name = 'Name is required';

    const checkInt = (label: keyof FormState) => {
      const v = (draft[label] ?? '').trim();
      if (!v) e[label] = `${label} is required`;
      else if (!isIntegerString(v)) e[label] = `${label} must be a non-negative integer`;
    };

    checkInt('zero');
    checkInt('ten');
    checkInt('twenty');
    checkInt('thirty');
    checkInt('remaining');

    // uniqueness (create only)
    if (!editingId && rows.some(r => r.id === draft.id.trim())) {
      e.id = `ID "${draft.id.trim()}" already exists`;
    }
    return e;
  };

  const hasErrors = Boolean(
    errors.id || errors.name || errors.zero || errors.ten || errors.twenty || errors.thirty || errors.remaining
  );

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors());
  }, [form, showForm, viewing]);

  /* ---- Actions ---- */
  const startNew = () => {
    setViewing(false);
    setEditingId(null);
    setForm(emptyVM());
    setErrors({});
    setShowForm(true);
  };

  const startView = (row: SkillProgressionType) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: SkillProgressionType) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: SkillProgressionType) => {
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
    const e = computeErrors(form);
    setErrors(e);
    const top = e.id || e.name || e.zero || e.ten || e.twenty || e.thirty || e.remaining || '';
    if (top) return;

    const payload = fromVM(form);
    const isEditing = Boolean(editingId);
    try {
      const opts = isEditing
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };
      await upsertSkillprogressiontype(payload, opts);

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
        description: `Skill progression type "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
      });
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Save failed',
        description: String(err instanceof Error ? err.message : err),
      });
    }
  };

  const onDelete = async (row: SkillProgressionType) => {
    const ok = await confirm({
      title: 'Delete Skill Progression Type',
      body: `Delete "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter(r => r.id !== row.id));
    try {
      await deleteSkillprogressiontype(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Skill progression type "${row.id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  /* ---- Columns / Table ---- */
  const columns: ColumnDef<SkillProgressionType>[] = useMemo(() => [
    { id: 'id', header: 'id', accessor: r => r.id, sortType: 'string', minWidth: 350 },
    { id: 'name', header: 'name', accessor: r => r.name, sortType: 'string', minWidth: 180 },
    { id: 'zero', header: '0–9', accessor: r => r.zero, sortType: 'number', align: 'center', minWidth: 90, },
    { id: 'ten', header: '10–19', accessor: r => r.ten, sortType: 'number', align: 'center', minWidth: 90, },
    { id: 'twenty', header: '20–29', accessor: r => r.twenty, sortType: 'number', align: 'center', minWidth: 90, },
    { id: 'thirty', header: '30–39', accessor: r => r.thirty, sortType: 'number', align: 'center', minWidth: 90, },
    { id: 'remaining', header: '40+', accessor: r => r.remaining, sortType: 'number', align: 'center', minWidth: 90, },
    {
      id: 'actions', header: 'actions', sortable: false, width: 360,
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

  const globalFilter = (r: SkillProgressionType, q: string) => {
    const s = q.toLowerCase();
    return [
      r.id, r.name,
      r.zero, r.ten, r.twenty, r.thirty, r.remaining,
    ].some(v => String(v ?? '').toLowerCase().includes(s));
  };

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Skill Progression Types</h2>

      {/* Toolbar hidden while form visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
          <button onClick={startNew}>New Skill Progression Type</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skill progression types…"
            aria-label="Search skill progression types"
          />
        </div>
      )}

      {/* Form panel */}
      {showForm && (
        <div
          className={`form-panel ${viewing ? 'form-panel--view' : ''}`}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}
        >
          <h3 style={{ marginTop: 0 }}>
            {viewing ? 'View Skill Progression Type' : (editingId ? 'Edit Skill Progression Type' : 'New Skill Progression Type')}
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
              label="0–9 (zero)"
              value={form.zero}
              onChange={(v) => setForm(s => ({ ...s, zero: sanitizeUnsignedInt(v) }))}
              disabled={viewing}
              inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
              error={viewing ? undefined : errors.zero}
            />

            <LabeledInput
              label="10–19 (ten)"
              value={form.ten}
              onChange={(v) => setForm(s => ({ ...s, ten: sanitizeUnsignedInt(v) }))}
              disabled={viewing}
              inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
              error={viewing ? undefined : errors.ten}
            />

            <LabeledInput
              label="20–29 (twenty)"
              value={form.twenty}
              onChange={(v) => setForm(s => ({ ...s, twenty: sanitizeUnsignedInt(v) }))}
              disabled={viewing}
              inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
              error={viewing ? undefined : errors.twenty}
            />

            <LabeledInput
              label="30–39 (thirty)"
              value={form.thirty}
              onChange={(v) => setForm(s => ({ ...s, thirty: sanitizeUnsignedInt(v) }))}
              disabled={viewing}
              inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
              error={viewing ? undefined : errors.thirty}
            />

            <LabeledInput
              label="40+ (remaining)"
              value={form.remaining}
              onChange={(v) => setForm(s => ({ ...s, remaining: sanitizeUnsignedInt(v) }))}
              disabled={viewing}
              inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
              error={viewing ? undefined : errors.remaining}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!viewing && <button onClick={saveForm} disabled={hasErrors}>Save</button>}
            <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {/* Table hidden while form visible */}
      {!showForm && (
        <DataTable<SkillProgressionType>
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
          tableMinWidth={900}
          zebra
          hover
          resizable
          persistKey="dt.skillprogressiontype.v1"
          ariaLabel="Skill progression types"
        />
      )}
    </>
  );
}
