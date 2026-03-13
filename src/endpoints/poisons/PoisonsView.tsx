import { useEffect, useMemo, useState } from 'react';
import { fetchPoisons, upsertPoison, deletePoison } from './api';
import type { Poison, PoisonFormState } from '../../types';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

export default function PoisonsView() {
  const [rows, setRows] = useState<Poison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: keyof Poison | 'level-variance'; dir: 'asc' | 'desc' }>({
    key: 'name',
    dir: 'asc',
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PoisonFormState>(emptyPoisonForm());
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
      [p.id, p.name, p.type, p.level, p['level-variance']]
        .some((v) => String(v ?? '').toLowerCase().includes(q))
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      const av = key === 'level' ? Number(a.level ?? 0) : String((a as Record<string, unknown>)[key] ?? '');
      const bv = key === 'level' ? Number(b.level ?? 0) : String((b as Record<string, unknown>)[key] ?? '');
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  const onSort = (key: keyof Poison | 'level-variance') =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );

  const startNew = () => {
    setEditingId(null);
    setForm(emptyPoisonForm());
    setFormErr('');
    setShowForm(true);
  };

  const startEdit = (row: Poison) => {
    setEditingId(row.id);
    setForm({
      id: row.id ?? '',
      name: row.name ?? '',
      type: row.type ?? '',
      level: Number(row.level ?? 0),
      levelVariance: String(row['level-variance'] ?? ''),
    });
    setFormErr('');
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setFormErr('');
  };

  const validate = (p: PoisonFormState): string => {
    if (!p.id?.trim()) return 'id is required';
    if (!p.name?.trim()) return 'name is required';
    if (!p.type?.trim()) return 'type is required';
    if (p.level === '' || p.level === null || Number.isNaN(Number(p.level))) return 'level must be a number';
    if (!p.levelVariance?.trim()) return 'level-variance is required';
    return '';
  };

  const saveForm = async () => {
    const payload: Poison = {
      id: String(form.id).trim(),
      name: String(form.name).trim(),
      type: String(form.type).trim(),
      level: Number(form.level),
      'level-variance': String(form.levelVariance).trim(),
    };
    const msg = validate(form);
    if (msg) {
      setFormErr(msg);
      return;
    }

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

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
        <button onClick={startNew}>New Poison</button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search poisons…"
          style={{ padding: 8, width: 360, maxWidth: '100%' }}
          aria-label="Search poisons"
        />
      </div>

      {showForm && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16, background: '#fafafa' }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Poison' : 'New Poison'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput label="ID" value={form.id} onChange={(v) => setForm((s) => ({ ...s, id: v }))} disabled={!!editingId} />
            <LabeledInput label="Name" value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} />
            <LabeledInput label="Type" value={form.type} onChange={(v) => setForm((s) => ({ ...s, type: v }))} />
            <LabeledInput label="Level" value={String(form.level)} onChange={(v) => setForm((s) => ({ ...s, level: v }))} type="number" />
            <LabeledInput label="Level-Variance" value={form.levelVariance} onChange={(v) => setForm((s) => ({ ...s, levelVariance: v }))} />
          </div>

          {formErr && <div style={{ color: 'crimson', marginTop: 8 }}>{formErr}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveForm}>Save</button>
            <button onClick={cancelForm} type="button">Cancel</button>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 950, width: '100%' }}>
          <thead>
            <tr>
              <SortableTh onClick={() => onSort('id')} label="id" sort={sort} colKey="id" />
              <SortableTh onClick={() => onSort('name')} label="name" sort={sort} colKey="name" />
              <SortableTh onClick={() => onSort('type')} label="type" sort={sort} colKey="type" />
              <SortableTh onClick={() => onSort('level')} label="level" sort={sort} colKey="level" />
              <SortableTh onClick={() => onSort('level-variance')} label="level-variance" sort={sort} colKey="level-variance" />
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 8 }}>actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={6} style={emptyCell}>No results.</td></tr>
            ) : (
              sorted.map((p) => (
                <tr key={p.id}>
                  <td style={tdStyle}>{p.id}</td>
                  <td style={tdStyle}>{p.name}</td>
                  <td style={tdStyle}>{p.type}</td>
                  <td style={tdStyle}>{p.level}</td>
                  <td style={tdStyle}>{p['level-variance']}</td>
                  <td style={tdStyle}>
                    <button onClick={() => startEdit(p)} style={{ marginRight: 6 }}>Edit</button>
                    <button onClick={() => onDelete(p)} style={{ color: '#b00020' }}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: 'text' | 'number';
  disabled?: boolean;
}) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>
      <span>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        disabled={disabled}
        style={{ padding: 8 }}
      />
    </label>
  );
}

function SortableTh<T extends string>({
  onClick,
  label,
  sort,
  colKey,
}: {
  onClick: () => void;
  label: string;
  sort: { key: T; dir: 'asc' | 'desc' };
  colKey: T;
}) {
  const active = sort.key === colKey;
  const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <th
      onClick={onClick}
      style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: '8px', cursor: 'pointer', userSelect: 'none' }}
      title={`Sort by ${label}`}
      scope="col"
    >
      {label}{arrow}
    </th>
  );
}

const tdStyle: React.CSSProperties = { borderBottom: '1px solid #f0f0f0', padding: '8px' };
const emptyCell: React.CSSProperties = { padding: 12, textAlign: 'center', color: '#666' };

function emptyPoisonForm(): PoisonFormState {
  return { id: '', name: '', type: '', level: 0, levelVariance: '' };
}