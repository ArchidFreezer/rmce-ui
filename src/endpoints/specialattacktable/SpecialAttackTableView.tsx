import { useEffect, useMemo, useRef, useState } from 'react';
import { DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import { LabeledInput } from '../../components/inputs/LabeledInput';
import { AttackTableEditor, type AttackTableRowVM } from '../../components/inputs/AttackTableEditor';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { isValidID, makeIDOnChange } from '../../utils/inputHelpers';

import {
  fetchSpecialattacktables,
  upsertSpecialattacktable,
  deleteSpecialattacktable,
} from '../../api/specialattacktable';

import type { SpecialAttackTable } from '../../types/specialattacktable';
import type { AttackTableRow } from '../../types/attacktable';

const prefix = 'SPECIALATTACKTABLE_';

// ---- VM conversions for the row grid (20 cells) ----
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

// Helpers (non-negative int sanitizer & validator)
const INT_RE = /^\d+$/;
const sanitizeInt = (s: string) => s.replace(/[^\d]/g, '');

export default function SpecialattacktablesView() {
  const dtRef = useRef<DataTableHandle>(null);
  const [rows, setRows] = useState<SpecialAttackTable[]>([]);
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
    small?: string | undefined;
    medium?: string | undefined;
    large?: string | undefined;
    huge?: string | undefined;
    maxRow?: string | undefined;
    modified?: string | undefined;
    unmodified?: string | undefined;
  }>({});

  const toast = useToast();
  const confirm = useConfirm();

  // Load list
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchSpecialattacktables();
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

  // Validation
  const computeErrors = (draft = form) => {
    const e: typeof errors = {};
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
      else if (!INT_RE.test(v)) e[k as keyof typeof e] = `${label} must be a non-negative integer`;
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
        if (!INT_RE.test(r.min) || !INT_RE.test(r.max)) {
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

  const hasErrors = Boolean(
    errors.id || errors.name || errors.small || errors.medium || errors.large || errors.huge ||
    errors.maxRow || errors.modified || errors.unmodified
  );

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors());
  }, [form, showForm, viewing]);

  // Actions
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
    setShowForm(false);
    setViewing(false);
    setEditingId(null);
    setErrors({});
  };

  const saveForm = async () => {
    const nextErrors = computeErrors(form);
    setErrors(nextErrors);
    const anyError = nextErrors.id || nextErrors.name || nextErrors.small || nextErrors.medium ||
      nextErrors.large || nextErrors.huge || nextErrors.maxRow || nextErrors.modified || nextErrors.unmodified;
    if (anyError) return;

    const payload = fromVM(form);
    const isEditing = Boolean(editingId);

    try {
      const opts = isEditing
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };
      await upsertSpecialattacktable(payload, opts);

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
        description: `Special attack table "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
      });
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Save failed',
        description: String(err instanceof Error ? err.message : err),
      });
    }
  };

  const onDelete = async (row: SpecialAttackTable) => {
    const ok = await confirm({
      title: 'Delete Special Attack Table',
      body: `Delete "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter(r => r.id !== row.id));
    try {
      await deleteSpecialattacktable(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Special attack table "${row.id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  // Columns
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

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Special Attack Tables</h2>

      {!showForm && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
          <button onClick={startNew}>New Special Attack Table</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search special attack tables…"
            aria-label="Search special attack tables"
          />

          {/* Reset widths button */}
          <button
            type="button"
            onClick={() => dtRef.current?.resetColumnWidths()}
            title="Reset all column widths"
            style={{ marginLeft: 'auto' }}
          >
            Reset column widths
          </button>
        </div>
      )}

      {showForm && (
        <div
          className={`form-panel ${viewing ? 'form-panel--view' : ''}`}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}
        >
          <h3 style={{ marginTop: 0 }}>
            {viewing ? 'View Special Attack Table' : (editingId ? 'Edit Special Attack Table' : 'New Special Attack Table')}
          </h3>

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
              onChange={(v) => setForm(s => ({ ...s, small: sanitizeInt(v) }))}
              disabled={viewing}
              width={90}
              inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
              error={viewing ? undefined : errors.small}
            />
            <LabeledInput
              label="Max Medium Attack"
              value={form.medium}
              onChange={(v) => setForm(s => ({ ...s, medium: sanitizeInt(v) }))}
              disabled={viewing}
              width={90}
              inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
              error={viewing ? undefined : errors.medium}
            />
            <LabeledInput
              label="Max Large Attack"
              value={form.large}
              onChange={(v) => setForm(s => ({ ...s, large: sanitizeInt(v) }))}
              disabled={viewing}
              width={90}
              inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
              error={viewing ? undefined : errors.large}
            />
            <LabeledInput
              label="Max Huge Attack"
              value={form.huge}
              onChange={(v) => setForm(s => ({ ...s, huge: sanitizeInt(v) }))}
              disabled={viewing}
              width={90}
              inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
              error={viewing ? undefined : errors.huge}
            />
            <LabeledInput
              label="Max Row"
              value={form.maxRow}
              onChange={(v) => setForm(s => ({ ...s, maxRow: sanitizeInt(v) }))}
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

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!viewing && <button onClick={saveForm} disabled={hasErrors}>Save</button>}
            <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {!showForm && (
        <DataTable<SpecialAttackTable>
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
          tableMinWidth={1100}
          zebra
          hover
          resizable
          persistKey="dt.specialattacktable.v1"
          ariaLabel="Special attack tables"
        />
      )}
    </>
  );
}