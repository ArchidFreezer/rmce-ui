import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchSpecialAttackTables, upsertSpecialAttackTable, deleteSpecialAttackTable,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  AttackTableEditor, type AttackTableRowVM,
  LabeledInput,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  AttackTableRow,
  SpecialAttackTable,
} from '../../types';

import {
  isValidID, makeIDOnChange,
  isValidUnsignedInt, makeUnsignedIntOnChange,
} from '../../utils';

const prefix = 'SPECIALATTACKTABLE_';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */
const ensure20 = (a: string[]) => {
  const out = a.slice(0, 20);
  while (out.length < 20) out.push('-');
  return out.map(x => (x === '' ? '-' : x));
};

const rowToVM = (r: AttackTableRow): AttackTableRowVM => {
  const cells = Array.from({ length: 20 }, (_, i) => String((r as any)[`at${i + 1}`] ?? '-'));
  return { min: String(r.min), max: String(r.max), cells };
};

const vmToRow = (vm: AttackTableRowVM): AttackTableRow => {
  const min = Number(vm.min);
  const max = Number(vm.max);
  const fixed = ensure20(vm.cells.map(s => s.trim()));
  const obj: any = { min, max };
  for (let i = 0; i < 20; i++) obj[`at${i + 1}`] = fixed[i];
  return obj as AttackTableRow;
};

// ---- Form VM (strings for numeric fields while typing) ----
type FormState = {
  id: string;
  name: string;
  small: string;
  medium: string;
  large: string;
  huge: string;
  maxRow: string;
  modified: AttackTableRowVM[];
  unmodified: AttackTableRowVM[];
};

type FormErrors = {
  id?: string;
  name?: string;
  small?: string;
  medium?: string;
  large?: string;
  huge?: string;
  maxRow?: string;
  modified?: string;
  unmodified?: string;
};

const emptyVM = (): FormState => ({
  id: prefix,
  name: '',
  small: '',
  medium: '',
  large: '',
  huge: '',
  maxRow: '',
  modified: [],
  unmodified: [],
});

const toVM = (x: SpecialAttackTable): FormState => ({
  id: x.id,
  name: x.name,
  small: String(x.small),
  medium: String(x.medium),
  large: String(x.large),
  huge: String(x.huge),
  maxRow: String(x.maxRow),
  modified: x.modifiedRows.map(rowToVM),
  unmodified: (x.unmodifiedRows ?? []).map(rowToVM),
});

const fromVM = (vm: FormState): SpecialAttackTable => ({
  id: vm.id.trim(),
  name: vm.name.trim(),
  small: Number(vm.small),
  medium: Number(vm.medium),
  large: Number(vm.large),
  huge: Number(vm.huge),
  maxRow: Number(vm.maxRow),
  modifiedRows: vm.modified.map(vmToRow),
  unmodifiedRows: vm.unmodified.length ? vm.unmodified.map(vmToRow) : undefined,
});

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */

export default function SpecialattacktablesView() {
  const dtRef = useRef<DataTableHandle>(null);
  const [rows, setRows] = useState<SpecialAttackTable[]>([]);
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
          fetchSpecialAttackTables(),
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
  const computeErrors = (draft: FormState): FormErrors => {
    const e: FormErrors = {};
    const id = draft.id.trim();
    const name = draft.name.trim();

    if (!id) e.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === draft.id.trim())) e.id = `ID "${draft.id.trim()}" already exists`;
    else if (!isValidID(draft.id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;

    if (!name) e.name = 'Name is required';

    const check = (k: keyof FormState, label: string) => {
      const v = (draft[k] ?? '');
      if (typeof v !== 'string') return; // Guard against non-string, to avoid processing the AttackTableRowVM arrays
      if (!v) e[k as keyof typeof e] = `${label} is required`;
      else if (!isValidUnsignedInt(v)) e[k as keyof typeof e] = `${label} must be a non-negative integer`;
    };
    check('small', 'Small');
    check('medium', 'Medium');
    check('large', 'Large');
    check('huge', 'Huge');
    check('maxRow', 'Max Row');

    // Rows basic checks
    const rowCheck = (label: 'modified' | 'unmodified', arr: AttackTableRowVM[]) => {
      for (let i = 0; i < arr.length; i++) {
        const r = arr[i];
        if (!r) return; // Guard against null/undefined, should not happen
        if (!isValidUnsignedInt(r.min) || !isValidUnsignedInt(r.max)) {
          e[label] = `${label}[${i + 1}]: min/max must be non-negative integers`; break;
        }
        if (Number(r.min) > Number(r.max)) {
          e[label] = `${label}[${i + 1}]: min must be ≤ max`; break;
        }
        if (!Array.isArray(r.cells) || r.cells.length !== 20) {
          e[label] = `${label}[${i + 1}]: row must contain exactly 20 cells`; break;
        }
      }
    };
    rowCheck('modified', draft.modified);
    rowCheck('unmodified', draft.unmodified);

    // Unique on create
    if (!editingId && rows.some(r => r.id === id)) {
      e.id = `ID "${id}" already exists`;
    }

    return e;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing]);

  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */
  const columns: ColumnDef<SpecialAttackTable>[] = useMemo(() => [
    { id: 'id', header: 'ID', accessor: r => r.id, sortType: 'string', minWidth: 280 },
    { id: 'name', header: 'Name', accessor: r => r.name, sortType: 'string', minWidth: 180 },
    { id: 'small', header: 'Max Small Attack', accessor: r => r.small, sortType: 'number', align: 'right', minWidth: 90 },
    { id: 'medium', header: 'Max Medium Attack', accessor: r => r.medium, sortType: 'number', align: 'right', minWidth: 90 },
    { id: 'large', header: 'Max Large Attack', accessor: r => r.large, sortType: 'number', align: 'right', minWidth: 90 },
    { id: 'huge', header: 'Max Huge Attack', accessor: r => r.huge, sortType: 'number', align: 'right', minWidth: 90 },
    { id: 'maxRow', header: 'Max Row', accessor: r => r.maxRow, sortType: 'number', align: 'right', minWidth: 100 },
    { id: 'modifiedCount', header: 'Modified Rows', accessor: r => r.modifiedRows.length, sortType: 'number', align: 'right', minWidth: 140 },
    { id: 'unmodifiedCount', header: 'Unmodified Rows', accessor: r => (r.unmodifiedRows?.length ?? 0), sortType: 'number', align: 'right', minWidth: 140 },
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

  const globalFilter = (r: SpecialAttackTable, q: string) => {
    const s = q.toLowerCase();
    return [
      r.id, r.name, r.small, r.medium, r.large, r.huge, r.maxRow,
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

  const startView = (row: SpecialAttackTable) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: SpecialAttackTable) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: SpecialAttackTable) => {
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

      await upsertSpecialAttackTable(payload, opts);

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
        description: `Training Package "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: SpecialAttackTable) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Special Attack Table',
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
      await deleteSpecialAttackTable(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Special Attack Table "${row.id}" deleted.` });
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
      <h2>Special Attack Tables</h2>

      {/* Toolbar hidden while form visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={startNew}>New Special Attack Table</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search special attack tables…"
            aria-label="Search special attack tables"
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
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Special Attack Table</h3>

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
                label="Max Small Attack"
                value={form.small}
                onChange={makeUnsignedIntOnChange<typeof form>('small', setForm)}
                disabled={viewing}
                width={90}
                inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
                error={viewing ? undefined : errors.small}
              />
              <LabeledInput
                label="Max Medium Attack"
                value={form.medium}
                onChange={makeUnsignedIntOnChange<typeof form>('medium', setForm)}
                disabled={viewing}
                width={90}
                inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
                error={viewing ? undefined : errors.medium}
              />
              <LabeledInput
                label="Max Large Attack"
                value={form.large}
                onChange={makeUnsignedIntOnChange<typeof form>('large', setForm)}
                disabled={viewing}
                width={90}
                inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
                error={viewing ? undefined : errors.large}
              />
              <LabeledInput
                label="Max Huge Attack"
                value={form.huge}
                onChange={makeUnsignedIntOnChange<typeof form>('huge', setForm)}
                disabled={viewing}
                width={90}
                inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
                error={viewing ? undefined : errors.huge}
              />
              <LabeledInput
                label="Max Row"
                value={form.maxRow}
                onChange={makeUnsignedIntOnChange<typeof form>('maxRow', setForm)}
                disabled={viewing}
                width={110}
                inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
                error={viewing ? undefined : errors.maxRow}
              />
            </div>

            {/* Reuse shared grid editor */}
            <AttackTableEditor
              sectionKey="modified"
              title="Modified Rows"
              rows={form.modified}
              onChangeRows={(next) => setForm(s => ({ ...s, modified: next }))}
              viewing={viewing}
              error={errors.modified}
              minMaxWidth={72}
            />

            <AttackTableEditor
              sectionKey="unmodified"
              title="Unmodified Rows (optional)"
              rows={form.unmodified}
              onChangeRows={(next) => setForm(s => ({ ...s, unmodified: next }))}
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
          persistKey="dt.specialattacktable.v1"
          ariaLabel="Special attack tables"
        />
      )}
    </>
  );
}