import { useEffect, useMemo, useState } from 'react';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable'
import { fetchPoisons, upsertPoison, deletePoison } from './api';
import type { Poison } from '../../types';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { LabeledInput } from '../../components/inputs';

type PoisonNumberKey = 'level';
type PoisonStringKey = Exclude<keyof Poison, PoisonNumberKey>; // 'id' | 'name' | 'type' | 'levelVariance'

export default function PoisonsView() {
  const [rows, setRows] = useState<Poison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const globalFilter = (p: Poison, q: string) => {
    const s = q.toLowerCase();
    return [p.id, p.name, p.type, p.level, p.levelVariance]
      .some(v => String(v ?? '').toLowerCase().includes(s));
  };

  const columns: ColumnDef<Poison>[] = [
    { id: 'id', header: 'Id', accessor: r => r.id, width: 350 },
    { id: 'name', header: 'Name', accessor: r => r.name },
    { id: 'type', header: 'Type', accessor: r => r.type },
    { id: 'level', header: 'Level', accessor: r => r.level, sortType: 'number', align: 'right' },
    { id: 'levelVariance', header: 'Level Variance', accessor: r => r.levelVariance },
    {
      id: 'actions',
      header: 'Actions',
      sortable: false,
      render: (row) => (
        <>
          <button onClick={() => startEdit(row)} style={{ marginRight: 6 }}>Edit</button>
          <button onClick={() => onDelete(row)} style={{ color: '#b00020' }}>Delete</button>
        </>
      ),
    },
  ];

  const [sort, setSort] = useState<{ key: keyof Poison; dir: 'asc' | 'desc' }>({
    key: 'name',
    dir: 'asc',
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // We’ll keep the form typed as Poison. While typing, "level" is edited as a string in the input,
  // so we provide helpers to read/write it safely.
  const [form, setForm] = useState<Poison>(emptyPoison());
  const [formErr, setFormErr] = useState('');

  const confirm = useConfirm();
  const toast = useToast();

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) =>
      [p.id, p.name, p.type, p.level, p.levelVariance]
        .some((v) => String(v ?? '').toLowerCase().includes(q))
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;

    const isNumberKey = (k: keyof Poison): k is PoisonNumberKey => k === 'level';

    arr.sort((a, b) => {
      if (isNumberKey(key)) {
        const av = a[key] as number;
        const bv = b[key] as number;
        return dir === 'asc' ? av - bv : bv - av;
      }
      const av = String(a[key as PoisonStringKey] ?? '');
      const bv = String(b[key as PoisonStringKey] ?? '');
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });

    return arr;
  }, [filtered, sort]);

  const onSort = (key: keyof Poison) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );

  const startNew = () => {
    setEditingId(null);
    setForm(emptyPoison());
    setFormErr('');
    setShowForm(true);
  };

  const startEdit = (row: Poison) => {
    setEditingId(row.id);
    // Copy row into form
    setForm({ ...row });
    setFormErr('');
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setFormErr('');
  };

  const validate = (p: Poison): string => {
    if (!p.id?.trim()) return 'id is required';
    if (!p.name?.trim()) return 'name is required';
    if (!p.type?.trim()) return 'type is required';
    if (!Number.isFinite(p.level as number) || Number(p.level) === 0 && String(getLevelInputValue(p)) === '') {
      // If user cleared the field, Number('') = 0; we check the raw input string below
      /* noop – we’ll handle using getLevelInputValue() */
    }
    const levelStr = getLevelInputValue(p);
    if (levelStr === '' || Number.isNaN(Number(levelStr))) return 'level must be a number';
    if (!p.levelVariance?.trim()) return 'levelVariance is required';
    return '';
  };

  const saveForm = async () => {
    // validate against current form values (with raw string view for level)
    const msg = validate(form);
    if (msg) {
      setFormErr(msg);
      return;
    }

    // Normalize payload to Poison while ensuring number coercion for level
    const payload: Poison = {
      id: String(form.id).trim(),
      name: String(form.name).trim(),
      type: String(form.type).trim(),
      level: Number(getLevelInputValue(form)),            // ensure number
      levelVariance: String(form.levelVariance).trim(),
    };

    try {
      const opts = editingId
        ? { method: 'POST' as const, useResourceIdPath: false }
        : { method: 'POST' as const, useResourceIdPath: false };

      await upsertPoison(payload, opts);

      setRows((prev) => {
        const idx = prev.findIndex((p) => p.id === payload.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...payload };
          return copy;
        }
        return [payload, ...prev];
      });

      setShowForm(false);
      setFormErr('');
      toast({ variant: 'success', title: 'Saved', description: `Poison "${payload.id}" saved.` });
    } catch (err) {
      toast({ variant: 'danger', title: 'Save failed', description: String(err instanceof Error ? err.message : err) });
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
      toast({ variant: 'success', title: 'Deleted', description: `Poison "${id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

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

    {/* Form panel (unchanged) */}
    {showForm && (
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, background: 'var(--panel)' }}>
        <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Poison' : 'New Poison'}</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <LabeledInput label="ID" value={form.id} onChange={(v) => setForm((s) => ({ ...s, id: v }))} disabled={!!editingId} />
          <LabeledInput label="Name" value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} />
          <LabeledInput label="Type" value={form.type} onChange={(v) => setForm((s) => ({ ...s, type: v }))} />
          <LabeledInput label="Level" type="number" value={getLevelInputValue(form)} onChange={(v) => setLevelFromInput(v)} />
          <LabeledInput label="Level Variance" value={form.levelVariance} onChange={(v) => setForm((s) => ({ ...s, levelVariance: v }))} />
        </div>

        {formErr && <div style={{ color: 'crimson', marginTop: 8 }}>{formErr}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={saveForm}>Save</button>
          <button onClick={cancelForm} type="button">Cancel</button>
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
        tableMinWidth={900}
        zebra
        // Resizable columns
        resizable
        persistKey="dt.poisons.v1"
        onColumnResizeEnd={(widths) => {
          // optional: log or sync widths
          console.log('Poison widths(px):', widths);
        }}      />
    )}
  </>
);

  /** -------- Local helpers to safely handle "level" as text input -------- */

  function getLevelInputValue(p: Poison): string {
    // During editing, we store the user's current string in a symbol on the object (non-enumerable),
    // OR simply derive from the numeric value and let the input overwrite via setLevelFromInput.
    // Simpler approach: attach a hidden property on the form state for the raw string.
    const anyP = p as Poison & { __levelRaw?: string };
    if (anyP.__levelRaw !== undefined) return anyP.__levelRaw;
    return String(p.level ?? '');
  }

  function setLevelFromInput(v: string) {
    setForm((s) => {
      const next: Poison & { __levelRaw?: string } = { ...s };
      next.__levelRaw = v;
      // Only set numeric level when it parses; otherwise keep last numeric level so table stays valid
      const maybe = Number(v);
      if (!Number.isNaN(maybe)) next.level = maybe;
      return next;
    });
  }
}

const tdStyle: React.CSSProperties = { borderBottom: '1px solid #f0f0f0', padding: '8px' };
const emptyCell: React.CSSProperties = { padding: 12, textAlign: 'center', color: '#666' };

function emptyPoison(): Poison {
  return { id: '', name: '', type: '', level: 0, levelVariance: '' };
}
