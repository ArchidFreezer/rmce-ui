import { useEffect, useMemo, useState } from 'react';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable'
import { fetchPoisons, upsertPoison, deletePoison } from '../../api/poisons';
import { fetchPoisontypes } from '../../api/poisontypes';
import type { Poison, PoisonType } from '../../types';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { LabeledInput, LabeledSelect } from '../../components/inputs';
import { isIntegerString } from '../../components/inputs/validators';

export default function PoisonsView() {
  const [rows, setRows] = useState<Poison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // form state (Create & Edit)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [form, setForm] = useState<Poison>(emptyPoison());
  const [formErr, setFormErr] = useState(''); // legacy single message (kept for top-level)

  // Form state for loading the select options for poison types (if needed in the future)
  const [poisonTypes, setPoisonTypes] = useState<PoisonType[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);

  const toast = useToast();
  const confirm = useConfirm();

  // ----- Load Poisons -----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const poisons = await fetchPoisons();
        if (!mounted) return;
        setRows(poisons);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ----- Load Poison Types -----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const pts = await fetchPoisontypes();
        if (!mounted) return;
        setPoisonTypes(pts);
      } catch (e) {
        // If this fails, we’ll still render the form, but save-time validation will catch invalid types.
        console.error('Failed to load PoisonTypes', e);
      } finally {
        if (mounted) setTypesLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);
  const poisonTypeIds = useMemo(() => new Set(poisonTypes.map(pt => pt.id)), [poisonTypes]);

  // ----- Inline validation helpers -----
  const [errors, setErrors] = useState<{ id?: string; name?: string; type?: string; level?: string; variance?: string }>({});
  const hasErrors = Boolean(errors.id || errors.name || errors.type || errors.level || errors.variance);
  const computeErrors = (draft: Poison, isEditing: boolean) => {
    const next: { id?: string; name?: string; type?: string; level?: string; variance?: string } = {};
    // ID (only on create, must be unique and start with prefix in ucase and contain additional characters)
    if (!draft.id.trim()) next.id = 'ID is required';
    else if (!isEditing && rows.some(r => r.id === draft.id.trim())) next.id = `ID "${draft.id.trim()}" already exists`;
    if (!draft.id.trim().toUpperCase().startsWith('POISON_')) next.id = 'ID must start with "POISON_"';
    if (!/^[A-Z0-9_]+$/.test(draft.id.trim())) next.id = 'ID can only contain uppercase letters, numbers and underscores';
    if (draft.id.trim().length <= 7) next.id = 'ID must contain additional characters after "POISON_"';
    // Name
    if (!draft.name.trim()) next.name = 'Name is required';
    // Type
    if (!draft.type.trim()) next.type = 'Type is required';
    else if (!poisonTypeIds.has(draft.type.trim())) next.type = `Type "${draft.type.trim()}" is not a valid PoisonType id`;
    // Level (must be a number, but allow empty string for controlled input)
    const raw = (draft.level ?? '').toString().trim();
    if (!isIntegerString(raw)) next.level = `Level must be an integer`;
    // Variance must be a single uppercase character
    if (!draft.levelVariance.trim()) next.variance = `Level Variance is required`;
    if (!/^[A-Z]$/.test(draft.levelVariance.trim())) next.variance = 'Level Variance must be a single uppercase character';

    return next;
  };

  useEffect(() => {
    if (!showForm) return;
    const isEditing = Boolean(editingId);
    setErrors(computeErrors(form, isEditing));
  }, [form, editingId, showForm]); // keep current for live validation

  // ----- Handlers (Create / Edit / Delete) -----
  const startNew = () => {
    setViewing(false);
    setEditingId(null);
    setForm(emptyPoison());
    setErrors({});
    setFormErr('');
    setShowForm(true);
  };

  const startEdit = (row: Poison) => {
    setViewing(false);
    setEditingId(row.id);
    setForm({ ...row });
    setErrors({});
    setFormErr('');
    setShowForm(true);
  };

  const startDuplicate = (row: Poison) => {
    setViewing(false);
    setEditingId(null);

    const next = { ...row };
    next.id = 'POISON_';
    next.name += ' (Copy)';

    setForm(next); // if your form state = Poison
    setErrors?.({});      // if you have an errors object
    setShowForm(true);
  };

  const startView = (row: Poison) => {
    setViewing(true);
    setEditingId(row.id);       // we can reuse editingId to preload the item, but we won't allow saving
    setForm({ ...row });
    setErrors({});              // no need to compute field errors for read-only view, but we can keep formErr for any potential top-level messages
    setFormErr('');
    setShowForm(true);
  };

  const cancelForm = () => {
    setViewing(false);
    setShowForm(false);
    setEditingId(null);
    setErrors({});
    setFormErr('');
  };

  const saveForm = async () => {
    // Normalize payload to Poison while ensuring number coercion for level
    const payload: Poison = {
      id: String(form.id).trim(),
      name: String(form.name).trim(),
      type: String(form.type).trim(),
      level: Number(form.level),            // ensure number
      levelVariance: String(form.levelVariance).trim(),
    };

    const nextErrors = computeErrors(payload, Boolean(editingId));
    setErrors(nextErrors);
    const topError = nextErrors.id || nextErrors.name || nextErrors.type || nextErrors.level || nextErrors.variance || '';
    if (topError) { setFormErr(topError); return; }

    const isEditing = Boolean(editingId);
    try {
      const opts = editingId
        ? { method: 'PUT' as const, useResourceIdPath: true }
        : { method: 'POST' as const, useResourceIdPath: false };

      await upsertPoison(payload, opts);

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
      setFormErr('');
      toast({
        variant: 'success',
        title: isEditing ? 'Updated' : 'Saved',
        description: `Poison "${payload.id}" ${isEditing ? 'updated' : 'created'}.`,
      });
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Save failed',
        description: String(err instanceof Error ? err.message : err),
      });
    }
  };

  const onDelete = async (row: Poison) => {
    const id = row?.id;
    if (!id) return;
    const ok = await confirm({
      title: 'Delete Poison',
      body: `Delete poison "${id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter((p) => p.id !== id));
    try {
      await deletePoison(id);
      // if currently editing this item, close the form
      if (editingId === row.id) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Poison "${id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  // Display the human-friendly PoisonType.type instead of the raw Poison.type id in the table, using a memoized map for efficient lookup
  const poisonTypeLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const pt of poisonTypes) m.set(pt.id, pt.type);
    return m;
  }, [poisonTypes]);

  // ----- Columns (Edit + Delete) -----
  const columns: ColumnDef<Poison>[] = useMemo(() => {
    return [
      { id: 'id', header: 'ID', accessor: (r) => r.id, sortType: 'string', minWidth: 220 },
      { id: 'name', header: 'Name', accessor: (r) => r.name, sortType: 'string', minWidth: 180 },
      {
        id: 'type',
        header: 'Type',
        accessor: (r) => r.type,
        sortType: 'string',
        render: (r) => poisonTypeLabelById.get(r.type) ?? r.type,
      },
      { id: 'level', header: 'Level', accessor: r => r.level, sortType: 'number', align: 'center' },
      { id: 'levelVariance', header: 'Level Variance', accessor: r => r.levelVariance, sortType: 'string', align: 'center' },
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
  }, [rows, poisonTypeLabelById, editingId]); // allows closing form on self-delete

  // ----- Search -----
  const globalFilter = (p: Poison, q: string) => {
    const s = q.toLowerCase();
    return [p.id, p.name, poisonTypeLabelById.get(p.type) ?? p.type, p.level, p.levelVariance]
      .some(v => String(v ?? '').toLowerCase().includes(s));
  };

  // Prepare select options for Poison Types (for the LabeledSelect in the form), memoized for performance
  const poisonTypeOptions = useMemo(
    () =>
      poisonTypes.map((pt) => ({
        value: pt.id,                         // what we store in Poison.type
        label: `${pt.type}`,                  // what users see
      })),
    [poisonTypes]
  );

  // ----- Render -----
  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Poisons</h2>

      {/* New + Search */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
        <button onClick={startNew}>New Poison</button>
        <DataTableSearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search poisons…"
          aria-label="Search poisons"
        />
      </div>

      {/* Form panel (Create & Edit) */}
      {showForm && (
        <div className={`form-panel ${viewing ? 'form-panel--view' : ''}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Poison' : 'New Poison'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput label="ID" value={form.id} onChange={(v) => setForm((s) => ({ ...s, id: v }))} disabled={!!editingId || viewing} error={errors.id} />
            <LabeledInput label="Name" value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} error={errors.name} disabled={viewing} />

            <LabeledSelect
              label="Type"
              value={form.type}
              onChange={(v) => setForm(s => ({ ...s, type: v }))}
              options={poisonTypeOptions}
              disabled={typesLoading || viewing}
              error={viewing ? undefined : errors.type}
              helperText={typesLoading ? 'Loading Poison Types…' : 'Select a PoisonType id'}
            />

            <LabeledInput label="Level" type="number" value={String(form.level).trim()} disabled={viewing}
              onChange={(v) => setForm((s) => {
                // 1) Remove everything except digits
                let raw = v.replace(/[^\d]+/g, '');
                return { ...s, level: Number(raw) };
              })}
              inputProps={{ inputMode: 'numeric', pattern: '\\d*', }} // mobile numeric keypad
              error={errors.level}
            />

            <LabeledInput label="Level Variance" value={form.levelVariance} onChange={(v) => setForm((s) => ({ ...s, levelVariance: v }))} error={errors.variance} disabled={viewing} />
          </div>

          {formErr && <div style={{ color: 'crimson', marginTop: 8 }}>{formErr}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {!viewing && <button onClick={saveForm} disabled={hasErrors}>Save</button>}
            <button onClick={cancelForm} type="button">{viewing ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {/* Shared DataTable */}
      {loading ? (
        <div>Loading…</div>
      ) : error ? (
        <div style={{ color: 'crimson' }}>Error: {error}</div>
      ) : (
        <DataTable<Poison>
          rows={rows}
          columns={columns}
          rowId={(r) => r.id}
          initialSort={{ colId: 'name', dir: 'asc' }}
          // search
          searchQuery={query}
          globalFilter={globalFilter}
          // pagination (client)
          mode="client"
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
          // styles
          tableMinWidth={0} // Allow table to shrink below container width (enables horizontal scroll when needed)
          zebra
          // Resizable columns
          resizable
          persistKey="dt.poisons.v1"
          ariaLabel='Poisons data'
        />
      )}
      {!rows.length && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No posons found.
        </div>
      )}
    </>
  );
}

function emptyPoison(): Poison {
  return { id: 'POISON_', name: '', type: '', level: 0, levelVariance: '' };
}
