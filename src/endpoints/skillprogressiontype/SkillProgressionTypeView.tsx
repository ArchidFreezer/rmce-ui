import { useEffect, useMemo, useRef, useState } from 'react';
import { DataTable, type DataTableHandle, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import { LabeledInput } from '../../components/inputs';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { isValidID, makeIDOnChange, isValidSignedInt, makeSignedIntOnChange, isValidUnsignedInt, makeUnsignedIntOnChange } from '../../utils/inputHelpers';

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
  const dtRef = useRef<DataTableHandle>(null);
  const [rows, setRows] = useState<SkillProgressionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ id?: string | undefined; name?: string | undefined; zero?: string | undefined; ten?: string | undefined; twenty?: string | undefined; thirty?: string | undefined; remaining?: string | undefined; }>({});
  const hasErrors = Boolean(errors.id || errors.name || errors.zero || errors.ten || errors.twenty || errors.thirty || errors.remaining);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyVM());

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
    const payload = fromVM(form);

    const nextErrors = computeErrors(form);
    setErrors(nextErrors);
    if (hasErrors) return;

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
          {/* Reset and auto-fit column widths */}
          <button onClick={() => dtRef.current?.resetColumnWidths()} title="Reset all column widths" style={{ marginLeft: 'auto' }}>Reset column widths</button>
          <button onClick={() => dtRef.current?.autoFitAllColumns()}>Auto-fit all columns</button>
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

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!viewing && <button onClick={saveForm} disabled={hasErrors}>Save</button>}
            <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {/* Table hidden while form visible */}
      {!showForm && (
        <DataTable<SkillProgressionType>
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
          tableMinWidth={0}
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
