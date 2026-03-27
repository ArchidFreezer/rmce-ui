import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchTreasureCodes, upsertTreasureCode, deleteTreasureCode,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  LabeledInput,
  LabeledSelect,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  TreasureCode,
} from '../../types';

import {
  TREASUREVALUETYPES, type TreasureValueType,
} from '../../types/enum';

import {
  isValidID, makeIDOnChange,
} from '../../utils';

const prefix = 'TREASURECODE_';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */
type FormState = {
  id: string;
  itemsValueType: TreasureValueType | '';
  wealthValueType: TreasureValueType | '';
};

type FormErrors = {
  id?: string;
  itemsValueType?: string;
  wealthValueType?: string;
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

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */

export default function TreasureCodeView() {
  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<TreasureCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
        const [tc] = await Promise.all([
          fetchTreasureCodes(),
        ]);
        setRows(tc);
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
  const isTVT = (s: string) => (TREASUREVALUETYPES as readonly string[]).includes(s);

  const computeErrors = (draft: FormState): FormErrors => {
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

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing]);

  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */
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

  const globalFilter = (r: TreasureCode, q: string) =>
    [r.id, r.itemsValueType, r.wealthValueType]
      .some((v) => String(v).toLowerCase().includes(q.toLowerCase()));

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

      await upsertTreasureCode(payload, opts);

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
        description: `Treasure Code "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: TreasureCode) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Treasure Code',
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
      await deleteTreasureCode(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Treasure Code "${row.id}" deleted.` });
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
      <h2>Treasure Codes</h2>

      {/* Toolbar hidden while form visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={startNew}>New Treasure Code</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search treasure codes…"
            aria-label="Search treasure codes"
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
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Treasure Code</h3>

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
          initialSort={{ colId: 'id', dir: 'asc' }}
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