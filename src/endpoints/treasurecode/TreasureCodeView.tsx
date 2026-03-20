import { useEffect, useMemo, useRef, useState } from 'react';
import { DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import { LabeledInput, LabeledSelect } from '../../components/inputs';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

import { fetchTreasurecodes, upsertTreasurecode, deleteTreasurecode } from '../../api/treasurecode';
import type { TreasureCode } from '../../types/treasurecode';
import { TREASUREVALUETYPES, type TreasureValueType } from '../../types/enum';

import { isValidID, makeIDOnChange } from '../../utils/inputHelpers';

const prefix = 'TREASURECODE_';

/* ------------------------
   Form VM (same shape, strings for selects are fine)
------------------------- */
type FormState = {
  id: string;
  itemsValueType: TreasureValueType | '';
  wealthValueType: TreasureValueType | '';
};

const emptyVM = (): FormState => ({
  id: prefix,
  itemsValueType: '',
  wealthValueType: '',
});

const toVM = (x: TreasureCode): FormState => ({
  id: x.id,
  itemsValueType: x.itemsValueType,
  wealthValueType: x.wealthValueType,
});

const fromVM = (vm: FormState): TreasureCode => ({
  id: vm.id.trim(),
  itemsValueType: vm.itemsValueType as TreasureValueType,
  wealthValueType: vm.wealthValueType as TreasureValueType,
});


export default function TreasureCodeView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<TreasureCode[]>([]);
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
    itemsValueType?: string | undefined;
    wealthValueType?: string | undefined;
  }>({});

  const toast = useToast();
  const confirm = useConfirm();

  // ---- Load ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchTreasurecodes();
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
  const isTVT = (s: string) => (TREASUREVALUETYPES as readonly string[]).includes(s);

  const computeErrors = (draft = form) => {
    const e: typeof errors = {};
    if (!draft.id.trim()) e.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === draft.id.trim())) e.id = `ID "${draft.id.trim()}" already exists`;
    else if (!isValidID(draft.id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;

    if (!draft.itemsValueType) e.itemsValueType = 'Items value type is required';
    else if (!isTVT(draft.itemsValueType)) e.itemsValueType = 'Pick a valid value';

    if (!draft.wealthValueType) e.wealthValueType = 'Wealth value type is required';
    else if (!isTVT(draft.wealthValueType)) e.wealthValueType = 'Pick a valid value';

    return e;
  };

  const hasErrors = Boolean(errors.id || errors.itemsValueType || errors.wealthValueType);

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

  const startView = (row: TreasureCode) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: TreasureCode) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: TreasureCode) => {
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
    if (hasErrors) return;

    const payload = fromVM(form);
    const isEditing = Boolean(editingId);
    try {
      const opts = isEditing
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };
      await upsertTreasurecode(payload, opts);

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
        description: `Treasure code "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
      });
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Save failed',
        description: String(err instanceof Error ? err.message : err),
      });
    }
  };

  // ---- Table ----
  const columns: ColumnDef<TreasureCode>[] = useMemo(() => [
    { id: 'id', header: 'ID', accessor: r => r.id, sortType: 'string', minWidth: 260 },
    { id: 'itemsValueType', header: 'Items Value Type', accessor: r => r.itemsValueType, sortType: 'string', minWidth: 180 },
    { id: 'wealthValueType', header: 'Wealth Value Type', accessor: r => r.wealthValueType, sortType: 'string', minWidth: 180 },
    {
      id: 'actions',
      header: 'Actions',
      sortable: false,
      width: 340,
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

  const onDelete = async (row: TreasureCode) => {
    const ok = await confirm({
      title: 'Delete Treasure Code',
      body: `Delete treasure code "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter(r => r.id !== row.id));
    try {
      await deleteTreasurecode(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Treasure code "${row.id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  const globalFilter = (r: TreasureCode, q: string) => {
    const s = q.toLowerCase();
    return [r.id, r.itemsValueType, r.wealthValueType]
      .some(v => String(v ?? '').toLowerCase().includes(s));
  };

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Treasure Codes</h2>

      {/* Toolbar hidden while form is visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
          <button onClick={startNew}>New Treasure Code</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search treasure codes…"
            aria-label="Search treasure codes"
          />
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

      {/* Form panel */}
      {showForm && (
        <div
          className={`form-panel ${viewing ? 'form-panel--view' : ''}`}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}
        >
          <h3 style={{ marginTop: 0 }}>
            {viewing ? 'View Treasure Code' : (editingId ? 'Edit Treasure Code' : 'New Treasure Code')}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput label="ID" value={form.id} onChange={makeIDOnChange<typeof form>('id', setForm, prefix)} disabled={!!editingId || viewing} error={errors.id} />

            <LabeledSelect
              label="Items Value Type"
              value={form.itemsValueType}
              onChange={(v) => setForm(s => ({ ...s, itemsValueType: v as TreasureValueType }))}
              options={TREASUREVALUETYPES}
              disabled={viewing}
              error={viewing ? undefined : errors.itemsValueType}
            />

            <LabeledSelect
              label="Wealth Value Type"
              value={form.wealthValueType}
              onChange={(v) => setForm(s => ({ ...s, wealthValueType: v as TreasureValueType }))}
              options={TREASUREVALUETYPES}
              disabled={viewing}
              error={viewing ? undefined : errors.wealthValueType}
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
        <DataTable<TreasureCode>
          ref={dtRef}
          rows={rows}
          columns={columns}
          rowId={(r) => r.id}
          initialSort={{ colId: 'id', dir: 'asc' }}
          searchQuery={query}
          globalFilter={globalFilter}
          mode="client"
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50, 100]}
          tableMinWidth={800}
          zebra
          hover
          resizable
          persistKey="dt.treasurecode.v1"
          ariaLabel="Treasure codes"
        />
      )}

      {/* Empty dataset */}
      {!rows.length && !showForm && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No treasure codes found.
        </div>
      )}    </>
  );
}