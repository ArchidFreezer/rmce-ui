import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchClimates, upsertClimate, deleteClimate
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  CheckboxGroup,
  LabeledInput,
  LabeledSelect,
  PillList,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  Climate
} from '../../types';

import {
  PRECIPITATIONS, Precipitation,
  TEMPERATURES, Temperature
} from '../../types/enum';

import {
  isValidID, makeIDOnChange,
  requireAtLeastOne,
} from '../../utils';

const prefix = 'CLIMATE_';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */
type FormState = {
  id: string;
  name: string;
  temperature: Temperature | '';
  precipitations: Precipitation[];
};

type FormErrors = {
  id?: string;
  name?: string;
  temperature?: string;
  precipitations?: string;
};

const emptyVM = (): FormState => ({
  id: prefix,
  name: '',
  temperature: '',
  precipitations: [],
});

const toVM = (c: Climate): FormState => ({
  id: c.id,
  name: c.name,
  temperature: c.temperature,
  precipitations: c.precipitations,
});

const fromVM = (vm: FormState): Climate => ({
  id: vm.id.trim(),
  name: vm.name.trim(),
  temperature: vm.temperature as Temperature,
  precipitations: vm.precipitations,
});

/* ------------------------------------------------------------------ */
/* View                                                          */
/* ------------------------------------------------------------------ */
export default function ClimateView() {

  const dtRef = useRef<DataTableHandle>(null);

  const [rows, setRows] = useState<Climate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const hasErrors = Object.values(errors).some(Boolean);

  // table UX
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
        const [tp] = await Promise.all([
          fetchClimates(),
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
  const computeErrors = (draft: FormState): FormErrors => {
    const next: FormErrors = {};

    // ID
    if (!draft.id.trim()) next.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === draft.id.trim())) next.id = `ID "${draft.id.trim()}" already exists`;
    else if (!isValidID(draft.id, prefix)) next.id = `ID must start with "${prefix}" and contain additional characters`;

    // Name
    if (!draft.name.trim()) next.name = 'Name is required';

    // Temperature
    if (!draft.temperature) next.temperature = 'Temperature is required';
    else if (!TEMPERATURES.includes(draft.temperature)) next.temperature = `Must be one of: ${TEMPERATURES.join(', ')}`;

    // Precipitations
    const precipError = requireAtLeastOne(draft.precipitations, 'precipitation');
    if (precipError) next.precipitations = precipError;
    return next;
  };

  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing]);

  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */

  // Define sort order for temperatures (custom sortType doesn't work well with enums, so we convert to index)    
  const TEMP_ORDER: Temperature[] = ['Cold', 'Cool', 'Temperate', 'Warm', 'Hot'];
  const idx = (t: string) => Math.max(0, TEMP_ORDER.indexOf(t as Temperature));

  const columns: ColumnDef<Climate>[] = useMemo(() => {
    return [
      { id: 'id', header: 'ID', accessor: (r) => r.id, sortType: 'string', minWidth: 220 },
      { id: 'name', header: 'Name', accessor: (r) => r.name, sortType: 'string', minWidth: 180 },
      {
        id: 'temperature',
        header: 'Temperature',
        accessor: (r) => r.temperature,
        sortType: (a, b) => idx(a.temperature as string) - idx(b.temperature as string),
        minWidth: 140,
      },
      {
        id: 'precipitations', header: 'Precipitations', minWidth: 220,
        accessor: (r) => r.precipitations.join(', '),
        render: r => (<PillList values={r.precipitations} />),
      },
      {
        id: 'actions',
        header: 'Actions',
        sortable: false,
        width: 160,
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
  }, [rows]);

  // ----- Search -----
  const globalFilter = (r: Climate, q: string) => {
    const s = q.toLowerCase();
    return (
      r.id.toLowerCase().includes(s) ||
      r.name.toLowerCase().includes(s) ||
      r.temperature.toLowerCase().includes(s) ||
      r.precipitations.some((p) => p.toLowerCase().includes(s))
    );
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

  const startView = (row: Climate) => {
    setViewing(true);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: Climate) => {
    setViewing(false);
    setEditingId(row.id);
    setForm(toVM(row));
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: Climate) => {
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

      await upsertClimate(payload, opts);

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
        description: `Climate "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: Climate) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Climate',
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
      await deleteClimate(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Climate "${row.id}" deleted.` });
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
      <h2>Climates</h2>

      {/* Toolbar shown only when table visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
          <button onClick={startNew}>New Climate</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search climates…"
            aria-label="Search climates"
          />

          {/* Reset and auto-fit column widths */}
          <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
          <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
        </div>
      )}

      {/* Form panel (Create & Edit) */}
      {showForm && (
        <div className="form-container">
          {/* Simple overlay while submitting */}
          {submitting && (<div className="overlay"><Spinner size={24} /> <span>Saving…</span> </div>)}

          <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`}>
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Training Package</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <LabeledInput label="ID" value={form.id} onChange={makeIDOnChange<typeof form>('id', setForm, prefix)} disabled={!!editingId || viewing} error={errors.id} />
              <LabeledInput label="Name" value={form.name} onChange={(v) => setForm(s => ({ ...s, name: v }))} disabled={viewing} error={errors.name} />

              <LabeledSelect
                label="Temperature"
                value={form.temperature}
                onChange={(v) => setForm(s => ({ ...s, temperature: v as Temperature }))}
                options={TEMPERATURES}
                disabled={viewing}
                error={errors.temperature}
              />
              <div />

              <CheckboxGroup<Precipitation>
                label="Precipitations"
                value={form.precipitations}
                options={PRECIPITATIONS}    // can be a simple string array
                onChange={(vals) => setForm(s => ({ ...s, precipitations: vals }))}
                helperText="Choose all that apply"
                error={errors.precipitations}
                direction="row"
                columns={3}
                showSelectAll={!viewing}  // Hide select/clear all when viewing, as checkboxes are disabled and it's not relevant
                disabled={viewing}
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
          persistKey="dt.climate.v1"
          ariaLabel='Climate data'
        />
      )}
    </>
  );
}
