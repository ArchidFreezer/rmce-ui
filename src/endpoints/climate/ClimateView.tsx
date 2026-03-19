import { useEffect, useMemo, useState } from 'react';
import { fetchClimates, upsertClimate, deleteClimate } from '../../api/climate';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import type { Climate } from '../../types/climate';
import { PRECIPITATIONS, Precipitation, TEMPERATURES, Temperature } from '../../types/enum';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { CheckboxGroup, LabeledInput, LabeledSelect } from '../../components/inputs'
import { requireAtLeastOne, isValidID } from '../../components/inputs/validators';
import { makeIDOnChange } from '../../components/inputs/sanitisers';

const prefix = 'CLIMATE_';

export default function ClimateView() {

  const [rows, setRows] = useState<Climate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // table UX
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // form state (Create & Edit)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [form, setForm] = useState<Climate>(emptyClimate());
  const toast = useToast();
  const confirm = useConfirm();

  // ----- Load -----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchClimates();
        if (!mounted) return;
        setRows(data);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ----- Inline validation helpers -----
  const [errors, setErrors] = useState<{ id?: string; name?: string; temperature?: string; precipitations?: string }>({});
  const hasErrors = Boolean(errors.id || errors.name || errors.temperature || errors.precipitations);
  const computeErrors = (draft: Climate, isEditing: boolean) => {
    if (viewing) return {};             // suppress inline errors in view mode

    const next: { id?: string; name?: string; temperature?: string; precipitations?: string } = {};
    // ID
    if (!draft.id.trim()) next.id = 'ID is required';
    else if (!isEditing && rows.some(r => r.id === draft.id.trim())) next.id = `ID "${draft.id.trim()}" already exists`;
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
    if (!showForm) return;
    const isEditing = Boolean(editingId);
    setErrors(computeErrors(form, isEditing));
  }, [form, editingId, showForm]); // keep current

  // ----- Handlers (Create / Edit / Delete) -----
  const startNew = () => {
    setViewing(false);
    setEditingId(null);
    setForm(emptyClimate());   // reset form to empty state with prefix
    setErrors({});
    setShowForm(true);
  };

  const startEdit = (row: Climate) => {
    setViewing(false);
    setEditingId(row.id);
    setForm({ ...row });
    setErrors({});
    setShowForm(true);
  };

  const startDuplicate = (row: Climate) => {
    setViewing(false);
    setEditingId(null);

    const vm = { ...row }; // your Climate form already uses domain type as form state
    vm.id = prefix;
    vm.name += ' (Copy)';

    setForm(vm);
    setErrors({});
    setShowForm(true);
  };

  const startView = (row: Climate) => {
    setViewing(true);
    setEditingId(row.id);       // we can reuse editingId to preload the item, but we won't allow saving
    setForm({ ...row });
    setErrors({});              // no need to compute field errors for read-only view, but we can keep formErr for any potential top-level messages
    setShowForm(true);
  };

  const cancelForm = () => {
    setViewing(false);
    setShowForm(false);
    setEditingId(null);
    setErrors({});
  };

  const saveForm = async () => {
    const payload: Climate = {
      id: String(form.id).trim(),
      name: String(form.name).trim(),
      temperature: form.temperature as Temperature,
      precipitations: [...form.precipitations],
    };

    const nextErrors = computeErrors(payload, Boolean(editingId));
    setErrors(nextErrors);
    const topError = nextErrors.id || nextErrors.name || nextErrors.temperature || nextErrors.precipitations || '';
    if (topError) return;

    const isEditing = Boolean(editingId);
    try {
      // Default edit → PUT /rmce/objects/climate/{id}; create → POST /rmce/objects/climate/
      const opts = isEditing
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };

      await upsertClimate(payload, opts);

      setRows((prev) => {
        if (isEditing) {
          // replace existing row
          const idx = prev.findIndex((r) => r.id === payload.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...payload };
            return copy;
          }
          // fallback: if not found (rare), prepend
          return [payload, ...prev];
        }
        // create → prepend
        return [payload, ...prev];
      });

      setShowForm(false);
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
    }
  };

  const onDelete = async (row: Climate) => {
    const id = row?.id;
    if (!id) return;
    const ok = await confirm({
      title: 'Delete Climate',
      body: `Delete climate "${id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    // optimistic remove + rollback
    const prev = rows;
    setRows(prev.filter((r) => r.id !== id));
    try {
      await deleteClimate(id);
      // if currently editing this item, close the form
      if (editingId === id) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Climate "${id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  // ----- Columns (Edit + Delete) -----
  const columns: ColumnDef<Climate>[] = useMemo(() => {
    const chip = (p: string) => (
      <span
        key={p}
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          marginRight: 6,
          marginBottom: 4,
          borderRadius: 999,
          fontSize: 12,
          border: '1px solid var(--border)',
          background: 'var(--panel)',
        }}
        title={p}
      >
        {p}
      </span>
    );

    // Define sort order for temperatures (custom sortType doesn't work well with enums, so we convert to index)    
    const TEMP_ORDER: Temperature[] = ['Cold', 'Cool', 'Temperate', 'Warm', 'Hot'];
    const idx = (t: string) => Math.max(0, TEMP_ORDER.indexOf(t as Temperature));

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
        id: 'precipitations',
        header: 'Precipitations',
        accessor: (r) => r.precipitations.join(', '),
        sortType: 'string',
        minWidth: 220,
        render: (r) => (
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {r.precipitations.length === 0
              ? <span style={{ color: 'var(--muted)' }}>—</span>
              : r.precipitations.map(chip)}
          </div>
        ),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, editingId]); // allows closing form on self-delete

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

  // ----- Render -----
  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Climates</h2>

      {/* Form panel (Create & Edit) */}
      {showForm && (
        <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Climate' : 'New Climate'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput
              label="ID"
              value={form.id}
              onChange={makeIDOnChange<typeof form>('id', setForm, prefix)}
              disabled={!!editingId || viewing}
              error={errors.id}
            />
            <LabeledInput
              label="Name"
              value={form.name}
              onChange={(v) => setForm(s => ({ ...s, name: v }))}
              disabled={viewing}
              error={errors.name}
            />

            <LabeledSelect
              label="Temperature"
              value={form.temperature}
              onChange={(v) => setForm(s => ({ ...s, temperature: v as Temperature }))}
              options={TEMPERATURES}
              disabled={viewing}
              error={errors.temperature}
            />
            <div style={{ alignSelf: 'end', color: 'var(--muted)', fontSize: 12 }}>
              Allowed: {TEMPERATURES.join(', ')}
            </div>

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

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!viewing && <button onClick={saveForm} disabled={hasErrors}>Save</button>}
            <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {/* Shared DataTable */}
      {!showForm && (
        <>
          {/* Create + Search */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
            <button onClick={startNew}>New Climate</button>
            <DataTableSearchInput
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search climates…"
              aria-label="Search climates"
            />
          </div>

          <DataTable<Climate>
            rows={rows}
            columns={columns}
            rowId={(r) => r.id}
            initialSort={{ colId: 'name', dir: 'asc' }}
            // search
            searchQuery={query}
            globalFilter={globalFilter}
            // pagination
            mode="client"
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20, 50, 100]}
            // styles
            tableMinWidth={0} // Allow table to shrink below container width (enables horizontal scroll when needed)
            zebra
            hover
            // Resizable columns
            resizable
            persistKey="dt.climate.v1"
            ariaLabel="Climates data"
          />
        </>
      )}
      {!rows.length && !showForm && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No climates found.
        </div>
      )}
    </>
  );
}

function emptyClimate(): Climate {
  return { id: prefix, name: '', temperature: 'Temperate', precipitations: [] };
}