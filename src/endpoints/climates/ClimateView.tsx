// src/endpoints/climate/ClimateView.tsx
import { useEffect, useMemo, useState } from 'react';
import { fetchClimates, upsertClimate } from '../../api/climate';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import type { Climate, Precipitation, Temperature } from '../../types';
import { PRECIPITATIONS, TEMPERATURES } from '../../types';
import { useToast } from '../../components/Toast';

export default function ClimateView() {
  const [rows, setRows] = useState<Climate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // table UX
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // form state (Create only)
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Climate>(emptyClimate());
  const [formErr, setFormErr] = useState('');
  const toast = useToast();

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

  // Columns: id, name, temperature, precipitations[]
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
    ];
  }, []);

  // Global filter across all fields (including precipitation items)
  const globalFilter = (r: Climate, q: string) => {
    const s = q.toLowerCase();
    return (
      r.id.toLowerCase().includes(s) ||
      r.name.toLowerCase().includes(s) ||
      r.temperature.toLowerCase().includes(s) ||
      r.precipitations.some((p) => p.toLowerCase().includes(s))
    );
  };

  // ----- Form handlers -----
  const startNew = () => {
    setForm(emptyClimate());
    setFormErr('');
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setFormErr('');
  };

  const togglePrecip = (p: Precipitation) => {
    setForm((s) => {
      const has = s.precipitations.includes(p);
      return {
        ...s,
        precipitations: has
          ? s.precipitations.filter((x) => x !== p)
          : [...s.precipitations, p],
      };
    });
  };

  const validate = (c: Climate): string => {
    if (!c.id?.trim()) return 'id is required';
    if (!c.name?.trim()) return 'name is required';
    if (!c.temperature?.trim()) return 'temperature is required';
    if (!TEMPERATURES.includes(c.temperature)) return `temperature must be one of: ${TEMPERATURES.join(', ')}`;
    if (rows.some((r) => r.id === c.id.trim())) return `id "${c.id.trim()}" already exists`;
    return '';
  };

  const saveForm = async () => {
    const payload: Climate = {
      id: String(form.id).trim(),
      name: String(form.name).trim(),
      temperature: form.temperature,
      precipitations: [...form.precipitations],
    };
    const msg = validate(payload);
    if (msg) { setFormErr(msg); return; }

    try {
      // Default create: POST /rmce/climate/ with one climate JSON object
      await upsertClimate(payload, { method: 'POST', useResourceIdPath: false });

      // Optimistic UI update
      setRows((prev) => [payload, ...prev]);

      setShowForm(false);
      setFormErr('');
      toast({ variant: 'success', title: 'Saved', description: `Climate "${payload.id}" created.` });
    } catch (err) {
      toast({ variant: 'danger', title: 'Save failed', description: String(err instanceof Error ? err.message : err) });
    }
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

      {/* Form panel */}
      {showForm && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}>
          <h3 style={{ marginTop: 0 }}>New Climate</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput label="ID" value={form.id} onChange={(v) => setForm(s => ({ ...s, id: v }))} />
            <LabeledInput label="Name" value={form.name} onChange={(v) => setForm(s => ({ ...s, name: v }))} />
            
            <LabeledSelect
            label="Temperature"
            value={form.temperature}
            onChange={(v) => setForm(s => ({ ...s, temperature: v as Temperature }))}
            options={TEMPERATURES}
            />

            <small style={{ color: 'var(--muted)' }}>
            Allowed: {TEMPERATURES.join(', ')}
            </small>


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
            <button onClick={saveForm}>Save</button>
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
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: 'text';
}) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>
      <span>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        style={{ padding: 8 }}
      />
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: readonly string[];
}) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: 8 }}
      >
        <option value="">— Select —</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </label>
  );
}


function emptyClimate(): Climate {
  return { id: '', name: '', temperature: '' as unknown as Temperature, precipitations: [] };
}