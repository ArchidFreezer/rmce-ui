import { useEffect, useMemo, useState } from 'react';
import { fetchClimates, upsertClimate, deleteClimate } from '../../api/climate';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import type { Climate, Precipitation, Temperature } from '../../types';
import { PRECIPITATIONS, TEMPERATURES } from '../../types';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

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
  const [form, setForm] = useState<Climate>(emptyClimate());
  const [formErr, setFormErr] = useState(''); // legacy single message (kept for top-level)
  const [errors, setErrors] = useState<{ id?: string; name?: string; temperature?: string }>({});
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
  const computeErrors = (draft: Climate, isEditing: boolean) => {
    const next: { id?: string; name?: string; temperature?: string } = {};
    // ID
    if (!draft.id.trim()) next.id = 'ID is required';
    else if (!isEditing && rows.some(r => r.id === draft.id.trim())) next.id = `ID "${draft.id.trim()}" already exists`;
    // Name
    if (!draft.name.trim()) next.name = 'Name is required';
    // Temperature
    if (!draft.temperature) next.temperature = 'Temperature is required';
    else if (!TEMPERATURES.includes(draft.temperature)) next.temperature = `Must be one of: ${TEMPERATURES.join(', ')}`;
    return next;
  };

  useEffect(() => {
    if (!showForm) return;
    const isEditing = Boolean(editingId);
    setErrors(computeErrors(form, isEditing));
  }, [form, editingId, showForm]); // keep current

  const hasErrors = Boolean(errors.id || errors.name || errors.temperature);

  // ----- Handlers (Create / Edit / Delete) -----
  const startNew = () => {
    setEditingId(null);
    setForm(emptyClimate());
    setErrors({});
    setFormErr('');
    setShowForm(true);
  };

  const startEdit = (row: Climate) => {
    setEditingId(row.id);
    setForm({ ...row });
    setErrors({});
    setFormErr('');
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setErrors({});
    setFormErr('');
  };

  const togglePrecip = (p: Precipitation) => {
    setForm((s) => {
      const has = s.precipitations.includes(p);
      return {
        ...s,
        precipitations: has ? s.precipitations.filter((x) => x !== p) : [...s.precipitations, p],
      };
    });
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
    const topError = nextErrors.id || nextErrors.name || nextErrors.temperature || '';
    if (topError) { setFormErr(topError); return; }

    const isEditing = Boolean(editingId);
    try {
      // Default edit → PUT /rmce/objects/climate/{id}; create → POST /rmce/objects/climate/
      const opts = isEditing
        ? { method: 'POST' as const, useResourceIdPath: false } // ← use POST with body ID for upsert (simpler, and PUT with ID path can cause issues if ID is changed in future)
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
      setFormErr('');
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
    const ok = await confirm({
      title: 'Delete Climate',
      body: `Delete climate "${row.id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    // optimistic remove + rollback
    const prev = rows;
    setRows(prev.filter((r) => r.id !== row.id));
    try {
      await deleteClimate(row.id);
      // if currently editing this item, close the form
      if (editingId === row.id) cancelForm();
      toast({ variant: 'success', title: 'Deleted', description: `Climate "${row.id}" deleted.` });
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
      { id: 'id', header: 'id', accessor: (r) => r.id, sortType: 'string', minWidth: 220 },
      { id: 'name', header: 'name', accessor: (r) => r.name, sortType: 'string', minWidth: 180 },
      {
        id: 'temperature',
        header: 'temperature',
        accessor: (r) => r.temperature,
        sortType: (a, b) => idx(a.temperature as string) - idx(b.temperature as string),
        minWidth: 140,
      },
      {
        id: 'precipitations',
        header: 'precipitations',
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
        header: 'actions',
        sortable: false,
        width: 160,
        render: (row) => (
          <>
            <button onClick={() => startEdit(row)} style={{ marginRight: 6 }}>Edit</button>
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

      {/* Form panel (Create & Edit) */}
      {showForm && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Climate' : 'New Climate'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput
              label="ID"
              value={form.id}
              onChange={(v) => setForm(s => ({ ...s, id: v }))}
              disabled={!!editingId}
              error={errors.id}
            />
            <LabeledInput
              label="Name"
              value={form.name}
              onChange={(v) => setForm(s => ({ ...s, name: v }))}
              error={errors.name}
            />

            <LabeledSelect
              label="Temperature"
              value={form.temperature}
              onChange={(v) => setForm(s => ({ ...s, temperature: v as Temperature }))}
              options={TEMPERATURES}
              error={errors.temperature}
            />
            <div style={{ alignSelf: 'end', color: 'var(--muted)', fontSize: 12 }}>
              Allowed: {TEMPERATURES.join(', ')}
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 14, marginBottom: 6 }}>Precipitations</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {PRECIPITATIONS.map((p) => (
                  <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={form.precipitations.includes(p)}
                      onChange={() => togglePrecip(p)}
                    />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {formErr && <div style={{ color: 'crimson', marginTop: 8 }}>{formErr}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveForm} disabled={hasErrors}>Save</button>
            <button onClick={cancelForm} type="button">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
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
        // fit + UX
        tableMinWidth={0}
        zebra
        hover
        resizable
        persistKey="dt.climate.v1"
        ariaLabel="Climates data"
      />

      {!rows.length && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No climates found.
        </div>
      )}
    </>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: 'text';
  disabled?: boolean;
  error?: string | undefined;
}) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>
      <span>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${label}-error` : undefined}
        style={{
          padding: 8,
          border: error ? '1px solid #b00020' : '1px solid var(--border)',
          outline: 'none',
        }}
      />
      {error && (
        <span id={`${label}-error`} style={{ color: '#b00020', fontSize: 12 }}>
          {error}
        </span>
      )}
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: readonly string[];
  error?: string | undefined;
}) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${label}-error` : undefined}
        style={{
          padding: 8,
          border: error ? '1px solid #b00020' : '1px solid var(--border)',
          outline: 'none',
        }}
      >
        <option value="">— Select —</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {error && (
        <span id={`${label}-error`} style={{ color: '#b00020', fontSize: 12 }}>
          {error}
        </span>
      )}
    </label>
  );
}

function emptyClimate(): Climate {
  return { id: '', name: '', temperature: 'Temperate', precipitations: [] };
}