import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchAttackTables, upsertAttackTable, deleteAttackTable,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  AttackTableEditor, AttackTableRowVM,
  LabeledInput,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  AttackTable, AttackTableRow,
} from '../../types/attacktable';

import {
  isValidID, makeIDOnChange,
  isValidUnsignedInt, makeUnsignedIntOnChange,
} from '../../utils';

const prefix = 'ATTACKTABLE_';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */
type FormState = {
  id: string;
  name: string;
  maxRow: string;
  modified: AttackTableRowVM[];
  unmodified: AttackTableRowVM[];
};

type FormErrors = {
  id?: string;
  name?: string;
  maxRow?: string;
  modified?: string;
  unmodified?: string;
};

// Initial form state
const emptyVM = (): FormState => ({
  id: prefix,
  name: '',
  maxRow: '',
  modified: [],
  unmodified: [],
});

// --- helpers ---
function ensure20(a: string[]): string[] {
  const out = a.slice(0, 20);
  while (out.length < 20) out.push('-');
  return out.map(x => (x === '' ? '-' : x));
}

// Convert API row -> VM row
function rowToVM(r: AttackTableRow): AttackTableRowVM {
  const cells = Array.from({ length: 20 }, (_, i) => String((r as any)[`at${i + 1}`] ?? '-'));
  return { min: String(r.min), max: String(r.max), cells };
}

// Convert VM row -> API row
function vmToRow(vm: AttackTableRowVM): AttackTableRow {
  const min = Number(vm.min);
  const max = Number(vm.max);
  const fixed = ensure20(vm.cells.map(s => s.trim()));
  const obj: any = { min, max };
  for (let i = 0; i < 20; i++) obj[`at${i + 1}`] = fixed[i];
  return obj as AttackTableRow;
}

// Convert API -> VM (whole table)
function toVM(x: AttackTable): FormState {
  return {
    id: x.id,
    name: x.name,
    maxRow: String(x.maxRow),
    modified: x.modifiedRows.map(rowToVM),
    unmodified: (x.unmodifiedRows ?? []).map(rowToVM),
  };
}

// Convert VM -> API (whole table)
function fromVM(vm: FormState): AttackTable {
  return {
    id: vm.id.trim(),
    name: vm.name.trim(),
    maxRow: Number(vm.maxRow),
    modifiedRows: vm.modified.map(vmToRow),
    unmodifiedRows: vm.unmodified.length ? vm.unmodified.map(vmToRow) : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */

export default function AttackTablesView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<AttackTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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
        const [at] = await Promise.all([
          fetchAttackTables(),

        ]);
        setRows(at);
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
  function validateRowVM(label: 'modified' | 'unmodified', r: AttackTableRowVM | undefined, idx: number): string | undefined {
    if (!r) return `${label}[${idx + 1}]: row is undefined`;
    if (!isValidUnsignedInt(r.min) || !isValidUnsignedInt(r.max)) {
      return `${label}[${idx + 1}]: min/max must be non-negative integers`;
    }
    if (Number(r.min) > Number(r.max)) {
      return `${label}[${idx + 1}]: min must be ≤ max`;
    }
    if (!Array.isArray(r.cells) || r.cells.length !== 20) {
      return `${label}[${idx + 1}]: cells must be an array of 20 values`;
    }
    return undefined;
  }

  const computeErrors = (draft: FormState): FormErrors => {
    const next: typeof errors = {};
    if (!draft.id.trim()) next.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === draft.id.trim())) next.id = `ID "${draft.id.trim()}" already exists`;
    else if (!isValidID(draft.id, prefix)) next.id = `ID must start with "${prefix}" and contain additional characters`;

    if (!draft.name.trim()) next.name = 'Name is required';

    if (!draft.maxRow.trim()) next.maxRow = 'maxRow is required';
    else if (!isValidUnsignedInt(draft.maxRow.trim())) next.maxRow = 'maxRow must be a non-negative integer';

    // Validate rows
    for (let i = 0; i < draft.modified.length; i++) {
      const msg = validateRowVM('modified', draft.modified[i], i);
      if (msg) { next.modified = msg; break; }
    }
    for (let i = 0; i < draft.unmodified.length; i++) {
      const msg = validateRowVM('unmodified', draft.unmodified[i], i);
      if (msg) { next.unmodified = msg; break; }
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
  const columns: ColumnDef<AttackTable>[] = useMemo(() => [
    { id: 'id', header: 'id', accessor: r => r.id, sortType: 'string', minWidth: 280 },
    { id: 'name', header: 'name', accessor: r => r.name, sortType: 'string', minWidth: 180 },
    {
      id: 'maxRow',
      header: 'maxRow',
      accessor: r => r.maxRow,
      sortType: 'number',
      align: 'right',
      minWidth: 100,
    },
    {
      id: 'modifiedCount',
      header: 'modifiedRows',
      accessor: r => r.modifiedRows.length,
      sortType: 'number',
      align: 'right',
      minWidth: 140,
    },
    {
      id: 'unmodifiedCount',
      header: 'unmodifiedRows',
      accessor: r => (r.unmodifiedRows?.length ?? 0),
      sortType: 'number',
      align: 'right',
      minWidth: 140,
    },
    {
      id: 'actions',
      header: 'actions',
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
  ], [rows]);

  const globalFilter = (r: AttackTable, q: string) => {
    const s = q.toLowerCase();
    return [
      r.id, r.name, r.maxRow,
      r.modifiedRows.length, r.unmodifiedRows?.length ?? 0,
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

  const startView = (row: AttackTable) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: AttackTable) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: AttackTable) => {
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
        ? { method: 'PUT' as const }
        : { method: 'POST' as const };

      await upsertAttackTable(payload, opts);

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
        description: `Attack Table "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: AttackTable) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Attack Table',
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
      await deleteAttackTable(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Attack Table "${row.id}" deleted.` });
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
      <h2>Attack Tables</h2>

      {/* Toolbar hidden while form visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={startNew}>New Attack Table</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search attack tables…"
            aria-label="Search attack tables"
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
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Attack Table</h3>

            {/* Basics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
              <LabeledInput
                label="ID"
                value={form.id}
                onChange={makeIDOnChange<typeof form>('id', setForm, prefix)}  // string-based
                disabled={!!editingId || viewing}
                error={errors.id}
              />
              <LabeledInput
                label="Name"
                value={form.name}
                onChange={(v) => setForm((s) => ({ ...s, name: v }))}         // string-based
                disabled={viewing}
                error={errors.name}
              />
              <LabeledInput
                label="Max Row"
                value={form.maxRow}
                onChange={makeUnsignedIntOnChange<typeof form>('maxRow', setForm)} // string-based
                disabled={viewing}
                inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
                error={viewing ? undefined : errors.maxRow}
              />
            </div>

            {/* Modified Rows */}
            <AttackTableEditor
              sectionKey="modified"
              title="Modified Rows"
              rows={form.modified}
              onChangeRows={(next) => setForm((s) => ({ ...s, modified: next }))}
              viewing={viewing}
              error={errors.modified}
              minMaxWidth={72}
            />

            {/* Unmodified Rows */}
            <AttackTableEditor
              sectionKey="unmodified"
              title="Unmodified Rows (optional)"
              rows={form.unmodified}
              onChangeRows={(next) => setForm((s) => ({ ...s, unmodified: next }))}
              viewing={viewing}
              error={errors.unmodified}
              minMaxWidth={72}
            />

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
          persistKey="dt.attacktable.v1"
          ariaLabel="Attack tables"
        />
      )}
    </>
  );
}
