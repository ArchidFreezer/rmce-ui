import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchSkillprogressiontypes, upsertSkillprogressiontype, deleteSkillprogressiontype,
} from '../../api';

import {
  DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef,
  LabeledInput,
  Spinner,
  useConfirm, useToast,
} from '../../components';

import type {
  SkillProgressionType,
} from '../../types';

import {
  isValidID, makeIDOnChange,
  isValidSignedInt, makeSignedIntOnChange,
  isValidUnsignedInt, makeUnsignedIntOnChange,
} from '../../utils';

const prefix = 'SKILLPROGRESSIONTYPE_';

/* ------------------------------------------------------------------ */
/* VM types                                                           */
/* ------------------------------------------------------------------ */
type FormState = {
  id: string;
  name: string;
  zero: string;
  ten: string;
  twenty: string;
  thirty: string;
  remaining: string;
};

type FormErrors = {
  id?: string;
  name?: string;
  zero?: string;
  ten?: string;
  twenty?: string;
  thirty?: string;
  remaining?: string;
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
  const dtRef = useRef<DataTableHandle>(null);
  const [rows, setRows] = useState<SkillProgressionType[]>([]);
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
        const [spt] = await Promise.all([
          fetchSkillprogressiontypes(),
        ]);
        setRows(spt);
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
    const e: typeof errors = {};

    if (!draft.id.trim()) e.id = 'ID is required';
    else if (!editingId && rows.some(r => r.id === draft.id.trim())) e.id = `ID "${draft.id.trim()}" already exists`;
    else if (!isValidID(draft.id, prefix)) e.id = `ID must start with "${prefix}" and contain additional characters`;
    if (!draft.name.trim()) e.name = 'Name is required';

    if (!draft.zero) e.zero = 'Zero is required';
    else if (!isValidSignedInt(draft.zero)) e.zero = 'Zero must be an integer';

    const checkInt = (label: keyof FormState) => {
      const v = (draft[label] ?? '').trim();
      if (!v) e[label] = `${label} is required`;
      else if (!isValidUnsignedInt(v)) e[label] = `${label} must be a non-negative integer`;
    };

    checkInt('ten');
    checkInt('twenty');
    checkInt('thirty');
    checkInt('remaining');

    return e;
  };


  useEffect(() => {
    if (!showForm || viewing) return;
    setErrors(computeErrors(form));
  }, [form, showForm, viewing]);

  /* ------------------------------------------------------------------ */
  /* Table                                                              */
  /* ------------------------------------------------------------------ */
  const columns: ColumnDef<SkillProgressionType>[] = useMemo(() => [
    { id: 'id', header: 'id', accessor: r => r.id, sortType: 'string', minWidth: 350 },
    { id: 'name', header: 'name', accessor: r => r.name, sortType: 'string', minWidth: 180 },
    { id: 'zero', header: '0', accessor: r => r.zero, sortType: 'number', align: 'center', minWidth: 90, },
    { id: 'ten', header: '1-9', accessor: r => r.ten, sortType: 'number', align: 'center', minWidth: 90, },
    { id: 'twenty', header: '10-19', accessor: r => r.twenty, sortType: 'number', align: 'center', minWidth: 90, },
    { id: 'thirty', header: '20-29', accessor: r => r.thirty, sortType: 'number', align: 'center', minWidth: 90, },
    { id: 'remaining', header: '30+', accessor: r => r.remaining, sortType: 'number', align: 'center', minWidth: 90, },
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

      await upsertSkillprogressiontype(payload, opts);

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
        description: `Skill Progression Type "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
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

  const onDelete = async (row: SkillProgressionType) => {

    if (submitting) return;
    setSubmitting(true);

    const ok = await confirm({
      title: 'Delete Skill Progression Type',
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
      await deleteSkillprogressiontype(row.id);
      if (editingId === row.id || viewing) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Skill Progression Type "${row.id}" deleted.` });
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
      <h2>Skill Progression Types</h2>

      {/* Toolbar hidden while form visible */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={startNew}>New Skill Progression Type</button>
          <DataTableSearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skill progression types…"
            aria-label="Search skill progression types"
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
            <h3>{viewing ? 'View' : editingId ? 'Edit' : 'New'} Skill Progression Type</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <LabeledInput label="ID" value={form.id} onChange={makeIDOnChange<typeof form>('id', setForm, prefix)} disabled={!!editingId || viewing} error={errors.id} />
              <LabeledInput label="Name" value={form.name} onChange={(v) => setForm(s => ({ ...s, name: v }))} disabled={viewing} error={errors.name} />

              <LabeledInput label="0 (zero)" value={form.zero} disabled={viewing}
                onChange={makeSignedIntOnChange<typeof form>('zero', setForm)}
                inputProps={{ inputMode: 'numeric', pattern: '\\d*', }}
                error={errors.zero} />

              <LabeledInput label="1-9 (ten)" value={form.ten} disabled={viewing}
                onChange={makeUnsignedIntOnChange<typeof form>('ten', setForm)}
                inputProps={{ inputMode: 'numeric', pattern: '\\d*', }}
                error={errors.ten} />

              <LabeledInput label="10-19 (twenty)" value={form.twenty} disabled={viewing}
                onChange={makeUnsignedIntOnChange<typeof form>('twenty', setForm)}
                inputProps={{ inputMode: 'numeric', pattern: '\\d*', }}
                error={errors.twenty} />

              <LabeledInput label="20-29 (thirty)" value={form.thirty} disabled={viewing}
                onChange={makeUnsignedIntOnChange<typeof form>('thirty', setForm)}
                inputProps={{ inputMode: 'numeric', pattern: '\\d*', }}
                error={errors.thirty} />

              <LabeledInput label="30+ (remaining)" value={form.remaining} disabled={viewing}
                onChange={makeUnsignedIntOnChange<typeof form>('remaining', setForm)}
                inputProps={{ inputMode: 'numeric', pattern: '\\d*', }}
                error={errors.remaining} />
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
          persistKey="dt.skillprogressiontype.v1"
          ariaLabel="Skill progression types"
        />
      )}
    </>
  );
}
