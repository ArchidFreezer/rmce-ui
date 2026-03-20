import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import { LabeledInput, LabeledSelect } from '../../components/inputs';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

import { fetchAttacktables, upsertAttacktable, deleteAttacktable } from '../../api/attacktable';
import type { AttackTable, AttackTableRow } from '../../types/attacktable';

import { isValidID, makeIDOnChange, isValidUnsignedInt, makeUnsignedIntOnChange } from '../../utils/inputHelpers';

const prefix = 'ATTACKTABLE_';

/* -------------------------------------------------------
   Form VM (string inputs for numbers; rows edited via cells CSV)
------------------------------------------------------- */
type RowVM = {
  min: string;
  max: string;
  cells: string[]; // exactly 20
};

type FormState = {
  id: string;
  name: string;
  maxRow: string;
  modified: RowVM[];
  unmodified: RowVM[];
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
function rowToVM(r: AttackTableRow): RowVM {
  const cells = Array.from({ length: 20 }, (_, i) => String((r as any)[`at${i + 1}`] ?? '-'));
  return { min: String(r.min), max: String(r.max), cells };
}

// Convert VM row -> API row
function vmToRow(vm: RowVM): AttackTableRow {
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

// Helpers to update a row WITHOUT type widening
function updateRowField(row: RowVM, key: 'min' | 'max', val: string): RowVM {
  return { min: key === 'min' ? val : row.min, max: key === 'max' ? val : row.max, cells: row.cells.slice() };
}
function updateRowCell(row: RowVM, index: number, val: string): RowVM {
  const cells = row.cells.slice();
  cells[index] = val;
  return { min: row.min, max: row.max, cells };
}

export default function AttacktablesView() {
  const [rows, setRows] = useState<AttackTable[]>([]);
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
    maxRow?: string | undefined;
    modified?: string | undefined;
    unmodified?: string | undefined;
  }>({});

  const toast = useToast();
  const confirm = useConfirm();

  // ---- Load ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchAttacktables();
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
  function validateRowVM(label: 'modified' | 'unmodified', r: RowVM | undefined, idx: number): string | undefined {
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

  const computeErrors = (draft = form) => {
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

  const hasErrors = Boolean(errors.id || errors.name || errors.maxRow || errors.modified || errors.unmodified);

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors());
  }, [form, showForm, viewing]);

  // ---- Actions ----
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

    const nextErrors = computeErrors(form);
    setErrors(nextErrors);
    const anyError = nextErrors.id || nextErrors.name || nextErrors.maxRow || nextErrors.modified || nextErrors.unmodified;
    if (anyError) return;


    const payload = fromVM(form);
    const isEditing = Boolean(editingId);
    try {
      const opts = isEditing
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };

      await upsertAttacktable(payload, opts);

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
        description: `Attack table "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
      });
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Save failed',
        description: String(err instanceof Error ? err.message : err),
      });
    }
  };

  const onDelete = async (row: AttackTable) => {
    const ok = await confirm({
      title: 'Delete Attack Table',
      body: `Delete "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter(r => r.id !== row.id));
    try {
      await deleteAttacktable(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Attack table "${row.id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  // ---- Columns / Table ----
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
  ], []);

  const globalFilter = (r: AttackTable, q: string) => {
    const s = q.toLowerCase();
    return [
      r.id, r.name, r.maxRow,
      r.modifiedRows.length, r.unmodifiedRows?.length ?? 0,
    ].some(v => String(v ?? '').toLowerCase().includes(s));
  };

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Attack Tables</h2>

      {/* Toolbar hidden while form is visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
          <button onClick={startNew}>New Attack Table</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search attack tables…"
            aria-label="Search attack tables"
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
            {viewing ? 'View Attack Table' : (editingId ? 'Edit Attack Table' : 'New Attack Table')}
          </h3>

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
          <RichRowsEditor
            sectionKey="modified"
            title="Modified Rows"
            rows={form.modified}
            onChangeRows={(next) => setForm(s => ({ ...s, modified: next }))}
            viewing={viewing}
            error={errors.modified}
          />

          {/* Unmodified Rows */}
          <RichRowsEditor
            sectionKey="unmodified"
            title="Unmodified Rows (optional)"
            rows={form.unmodified}
            onChangeRows={(next) => setForm(s => ({ ...s, unmodified: next }))}
            viewing={viewing}
            error={errors.unmodified}
          />

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!viewing && <button onClick={saveForm} disabled={hasErrors}>Save</button>}
            <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {/* Table hidden while form visible */}
      {!showForm && (
        <DataTable<AttackTable>
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
          tableMinWidth={1000}
          zebra
          hover
          resizable
          persistKey="dt.attacktable.v1"
          ariaLabel="Attack tables"
        />
      )}
    </>
  );
}

/* ============================================================================================
   RichRowsEditor: compact grid for RowVM[]  (replaces the three LabeledInput fields)
   ============================================================================================ */
function RichRowsEditor({
  sectionKey,
  title,
  rows,
  onChangeRows,
  viewing,
  error,
}: {
  sectionKey: 'modified' | 'unmodified';
  title: string;
  rows: RowVM[];
  onChangeRows: (next: RowVM[]) => void;
  viewing?: boolean | undefined;
  error?: string | undefined;
}) {
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '90px 90px repeat(20, 70px) 100px',
    gap: 6,
    alignItems: 'center',
  };
  const totalCols = 22; // 0=min, 1=max, 2..21 = 20 cells

  const focusCell = (r: number, c: number) => {
    const id = `${sectionKey}-${r}-${c}`;
    const el = document.getElementById(id) as HTMLInputElement | null;
    el?.focus();
    el?.select?.();
  };

  const handleNav = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (viewing) return;
    const r = Number(e.currentTarget.dataset.row);
    const c = Number(e.currentTarget.dataset.col);
    if (Number.isNaN(r) || Number.isNaN(c)) return;

    const atStart = e.currentTarget.selectionStart === 0;
    const atEnd = e.currentTarget.selectionStart === e.currentTarget.value.length;

    switch (e.key) {
      case 'ArrowLeft':
        if (!atStart) return;
        e.preventDefault();
        if (c > 0) focusCell(r, c - 1);
        break;
      case 'ArrowRight':
        if (!atEnd) return;
        e.preventDefault();
        if (c < totalCols - 1) focusCell(r, c + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (r > 0) focusCell(r - 1, c);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (r < rows.length - 1) focusCell(r + 1, c);
        break;
      case 'Enter':
        e.preventDefault();
        if (e.shiftKey) {
          if (r > 0) focusCell(r - 1, c);
        } else {
          if (r < rows.length - 1) focusCell(r + 1, c);
        }
        break;
    }
  };

  // Accept CSV/TSV/whitespace — always return string[]
  const parsePasted = (text: string): string[] => {
    if (!text) return [];
    if (text.includes('\t')) return text.split('\t').map((s) => s.trim());
    if (text.includes(',')) return text.split(',').map((s) => s.trim());
    return text.trim().split(/\s+/);
  };

  const onPasteCells = (
    rowIdx: number,
    startCol: number,
    e: React.ClipboardEvent<HTMLInputElement>
  ) => {
    if (viewing) return;
    e.preventDefault();

    const values = parsePasted(e.clipboardData.getData('text'));
    if (!values.length) return;

    // 1) Bounds check row index
    if (rowIdx < 0 || rowIdx >= rows.length) return;

    const isInt = (s: string | undefined) => !!s && /^\d+$/.test(s);

    // 2) Clone array and narrow the row reference
    const next = rows.slice();
    const row0 = next[rowIdx];
    if (!row0) return; // <-- TS now knows row0 is RowVM below

    // Work on a non-optional RowVM copy
    let curr: RowVM = { min: row0.min, max: row0.max, cells: row0.cells.slice() };

    // Helper: return a full RowVM with cells applied
    const fillCellsFrom = (row: RowVM, src: string[], startAt: number): RowVM => {
      const cells = row.cells.slice();
      const limit = Math.min(20, src.length);
      for (let i = 0; i < limit; i++) {
        const idx = startAt + i;
        if (idx >= 20) break;
        const v = src[i] ?? '-';
        cells[idx] = v === '' ? '-' : v;  // ensure string
      }
      return { min: row.min, max: row.max, cells };
    };

    // 3) Apply paste
    if (startCol === 0) {
      const [minMaybe, maxMaybe, ...rest] = values;
      const min = isInt(minMaybe) ? minMaybe! : curr.min;
      const max = isInt(maxMaybe) ? maxMaybe! : curr.max;
      const base = isInt(minMaybe) && isInt(maxMaybe) ? rest : values;
      curr = { min, max, cells: curr.cells.slice() };
      curr = fillCellsFrom(curr, base, 0);
    } else if (startCol === 1) {
      const [maxMaybe, ...rest] = values;
      const max = isInt(maxMaybe) ? maxMaybe! : curr.max;
      const base = isInt(maxMaybe) && rest.length ? rest : values;
      curr = { min: curr.min, max, cells: curr.cells.slice() };
      curr = fillCellsFrom(curr, base, 0);
    } else {
      const cellIdx = Math.max(0, startCol - 2);
      curr = fillCellsFrom(curr, values, cellIdx);
    }

    // 4) Commit back a full RowVM (no partials, no widening)
    next[rowIdx] = curr;
    onChangeRows(next);
  };

  const header = (
    <div style={gridStyle}>
      <div style={{ fontWeight: 600 }}>min</div>
      <div style={{ fontWeight: 600 }}>max</div>
      {Array.from({ length: 20 }, (_, i) => (
        <div key={`h-${i}`} style={{ fontWeight: 600 }}>{`at${i + 1}`}</div>
      ))}
      <div style={{ fontWeight: 600 }}>actions</div>
    </div>
  );

  return (
    <section style={{ marginTop: 8 }}>
      <h4 style={{ margin: '8px 0' }}>{title}</h4>

      {!viewing && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            type="button"
            onClick={() =>
              onChangeRows([...rows, { min: '', max: '', cells: Array(20).fill('-') }])
            }
          >
            + Add row
          </button>
          {error && <span style={{ color: '#b00020' }}>{error}</span>}
        </div>
      )}
      {viewing && error && <div style={{ color: '#b00020' }}>{error}</div>}

      {header}

      <div role="grid" aria-label={`${title} grid`} style={{ display: 'grid', gap: 6 }}>
        {rows.map((r, rowIdx) => (
          <div key={`${sectionKey}-row-${rowIdx}`} style={gridStyle}>
            {/* min */}
            <LabeledInput
              label="min"
              hideLabel
              value={r.min}
              onChange={(val) => {
                if (viewing) return;
                const digits = val.replace(/[^\d]/g, '');
                if (rowIdx < 0 || rowIdx >= rows.length) return;
                const next = rows.slice();
                next[rowIdx] = updateRowField(r, 'min', digits);
                onChangeRows(next);
              }}
              disabled={viewing}
              width={64}
              inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
            />

            {/* max */}
            <LabeledInput
              label="max"
              hideLabel
              value={r.max}
              onChange={(val) => {
                if (viewing) return;
                const digits = val.replace(/[^\d]/g, '');
                if (rowIdx < 0 || rowIdx >= rows.length) return;
                const next = rows.slice();
                next[rowIdx] = updateRowField(r, 'max', digits);
                onChangeRows(next);
              }}
              disabled={viewing}
              width={64}
              inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
            />

            {/* at1..at20 */}
            {r.cells.map((cell, i) => (
              <input
                key={`${sectionKey}-${rowIdx}-c-${i}`}
                id={`${sectionKey}-${rowIdx}-${i + 2}`}
                data-row={rowIdx}
                data-col={i + 2}
                value={cell}
                onChange={(e) => {
                  if (viewing) return;
                  const val = e.target.value;
                  const next = rows.slice();
                  if (rowIdx < 0 || rowIdx >= next.length) return;
                  const row = next[rowIdx]; if (!row) return;
                  next[rowIdx] = updateRowCell(row, i, val === '' ? '' : val);  // a full RowVM
                  onChangeRows(next);
                }}
                onKeyDown={handleNav}
                onPaste={(e) => onPasteCells(rowIdx, i + 2, e)}
                disabled={viewing}
                style={{ padding: 6 }}
                aria-label={`Row ${rowIdx + 1} at${i + 1}`}
              />
            ))}

            {/* actions */}
            <div style={{ display: 'flex', gap: 6 }}>
              {!viewing && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const clone: RowVM = { min: r.min, max: r.max, cells: r.cells.slice() };
                      const next = rows.slice();
                      next.splice(rowIdx + 1, 0, clone);
                      onChangeRows(next);
                    }}
                    title="Duplicate row"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = rows.slice();
                      next.splice(rowIdx, 1);
                      onChangeRows(next);
                    }}
                    title="Remove row"
                    style={{ color: '#b00020' }}
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}