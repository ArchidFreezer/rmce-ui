import { useEffect, useMemo, useState } from 'react';
import { fetchArmourtypes, upsertArmourtype, deleteArmourtype } from './api';
import type { Armourtype, ArmourtypeFormState } from '../../types';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

export default function ArmourtypesView() {
  const [rows, setRows] = useState<Armourtype[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{
    key:
      | keyof Armourtype
      | 'min-manoeuvre-mod'
      | 'max-manoeuvre-mod'
      | 'missile-attack-penalty'
      | 'quickness-penalty';
    dir: 'asc' | 'desc';
  }>({
    key: 'name',
    dir: 'asc',
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ArmourtypeFormState>(emptyArmourtypeForm());
  const [formErr, setFormErr] = useState('');

  const confirm = useConfirm();
  const toast = useToast();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchArmourtypes();
        if (!mounted) return;
        setRows(data);
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
    return rows.filter(a =>
      [
        a.id,
        a.name,
        a.type,
        a.description,
        a['min-manoeuvre-mod'],
        a['max-manoeuvre-mod'],
        a['missile-attack-penalty'],
        a['quickness-penalty'],
        a['animal-only'],
        a['includes-greaves'],
      ]
        .map(v => String(v ?? '').toLowerCase())
        .some(s => s.includes(q))
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      // numeric fields
      if (
        key === 'min-manoeuvre-mod' ||
        key === 'max-manoeuvre-mod' ||
        key === 'missile-attack-penalty' ||
        key === 'quickness-penalty'
      ) {
        const av = Number((a as Record<string, unknown>)[key] ?? 0);
        const bv = Number((b as Record<string, unknown>)[key] ?? 0);
        return dir === 'asc' ? av - bv : bv - av;
      }
      // booleans sort as false < true
      if (key === 'animal-only' || key === 'includes-greaves') {
        const av = Boolean((a as Record<string, unknown>)[key]);
        const bv = Boolean((b as Record<string, unknown>)[key]);
        return dir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
      }
      // strings
      const av = String((a as Record<string, unknown>)[key] ?? '');
      const bv = String((b as Record<string, unknown>)[key] ?? '');
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  const onSort = (key: (typeof sort)['key']) =>
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

  const startNew = () => {
    setEditingId(null);
    setForm(emptyArmourtypeForm());
    setFormErr('');
    setShowForm(true);
  };

  const startEdit = (row: Armourtype) => {
    setEditingId(row.id);
    setForm({
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      minManoeuvreMod: row['min-manoeuvre-mod'],
      maxManoeuvreMod: row['max-manoeuvre-mod'],
      missileAttackPenalty: row['missile-attack-penalty'],
      quicknessPenalty: row['quickness-penalty'],
      animalOnly: row['animal-only'],
      includesGreaves: row['includes-greaves'],
    });
    setFormErr('');
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setFormErr('');
  };

  const validate = (f: ArmourtypeFormState): string => {
    if (!f.id?.trim()) return 'id is required';
    if (!f.name?.trim()) return 'name is required';
    if (!f.type?.trim()) return 'type is required';
    // numeric checks
    const nums: Array<[string, number]> = [
      ['min-manoeuvre-mod', Number(f.minManoeuvreMod)],
      ['max-manoeuvre-mod', Number(f.maxManoeuvreMod)],
      ['missile-attack-penalty', Number(f.missileAttackPenalty)],
      ['quickness-penalty', Number(f.quicknessPenalty)],
    ];
    for (const [label, val] of nums) {
      if (Number.isNaN(val)) return `${label} must be a number`;
    }
    return '';
  };

  const saveForm = async () => {
    const payload: Armourtype = {
      id: String(form.id).trim(),
      name: String(form.name).trim(),
      type: String(form.type).trim(),
      description: String(form.description ?? ''),
      'min-manoeuvre-mod': Number(form.minManoeuvreMod),
      'max-manoeuvre-mod': Number(form.maxManoeuvreMod),
      'missile-attack-penalty': Number(form.missileAttackPenalty),
      'quickness-penalty': Number(form.quicknessPenalty),
      'animal-only': Boolean(form.animalOnly),
      'includes-greaves': Boolean(form.includesGreaves),
    };
    const msg = validate(form);
    if (msg) {
      setFormErr(msg);
      return;
    }

    try {
      // Default: POST to /rmce/objects/armourtype/
      const opts = editingId
        ? { method: 'POST' as const, useResourceIdPath: false }
        : { method: 'POST' as const, useResourceIdPath: false };

      await upsertArmourtype(payload, opts);

      setRows(prev => {
        const idx = prev.findIndex(a => a.id === payload.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...payload };
          return copy;
        }
        return [payload, ...prev];
      });

      setShowForm(false);
      setFormErr('');
      toast({ variant: 'success', title: 'Saved', description: `Armourtype "${payload.id}" saved.` });
    } catch (err) {
      toast({ variant: 'danger', title: 'Save failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  const onDelete = async (row: Armourtype) => {
    const id = row?.id;
    if (!id) return;
    const ok = await confirm({
      title: 'Delete Armourtype',
      body: `Delete armourtype "${id}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    const prev = rows;
    setRows(prev.filter(a => a.id !== id));
    try {
      await deleteArmourtype(id);
      toast({ variant: 'success', title: 'Deleted', description: `Armourtype "${id}" deleted.` });
    } catch (err) {
      setRows(prev);
      toast({ variant: 'danger', title: 'Delete failed', description: String(err instanceof Error ? err.message : err) });
    }
  };

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Armour Types</h2>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
        <button onClick={startNew}>New Armourtype</button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search armourtypes…"
          style={{ padding: 8, width: 360, maxWidth: '100%' }}
          aria-label="Search armourtypes"
        />
      </div>

      {showForm && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16, background: '#fafafa' }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Armourtype' : 'New Armourtype'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput label="ID" value={form.id} onChange={(v) => setForm(s => ({ ...s, id: v }))} disabled={!!editingId} />
            <LabeledInput label="Name" value={form.name} onChange={(v) => setForm(s => ({ ...s, name: v }))} />
            <LabeledInput label="Type" value={form.type} onChange={(v) => setForm(s => ({ ...s, type: v }))} />
            <LabeledInput label="Description" value={form.description} onChange={(v) => setForm(s => ({ ...s, description: v }))} />
            <LabeledInput label="Min Manoeuvre Mod" type="number" value={String(form.minManoeuvreMod)} onChange={(v) => setForm(s => ({ ...s, minManoeuvreMod: v }))} />
            <LabeledInput label="Max Manoeuvre Mod" type="number" value={String(form.maxManoeuvreMod)} onChange={(v) => setForm(s => ({ ...s, maxManoeuvreMod: v }))} />
            <LabeledInput label="Missile Attack Penalty" type="number" value={String(form.missileAttackPenalty)} onChange={(v) => setForm(s => ({ ...s, missileAttackPenalty: v }))} />
            <LabeledInput label="Quickness Penalty" type="number" value={String(form.quicknessPenalty)} onChange={(v) => setForm(s => ({ ...s, quicknessPenalty: v }))} />
            <CheckboxInput label="Animal Only" checked={form.animalOnly} onChange={(c) => setForm(s => ({ ...s, animalOnly: c }))} />
            <CheckboxInput label="Includes Greaves" checked={form.includesGreaves} onChange={(c) => setForm(s => ({ ...s, includesGreaves: c }))} />
          </div>

          {formErr && <div style={{ color: 'crimson', marginTop: 8 }}>{formErr}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveForm}>Save</button>
            <button onClick={cancelForm} type="button">Cancel</button>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 1200, width: '100%' }}>
          <thead>
            <tr>
              <SortableTh onClick={() => onSort('id')} label="id" sort={sort} colKey="id" />
              <SortableTh onClick={() => onSort('name')} label="name" sort={sort} colKey="name" />
              <SortableTh onClick={() => onSort('type')} label="type" sort={sort} colKey="type" />
              <SortableTh onClick={() => onSort('description')} label="description" sort={sort} colKey="description" />
              <SortableTh onClick={() => onSort('min-manoeuvre-mod')} label="min-manoeuvre-mod" sort={sort} colKey="min-manoeuvre-mod" />
              <SortableTh onClick={() => onSort('max-manoeuvre-mod')} label="max-manoeuvre-mod" sort={sort} colKey="max-manoeuvre-mod" />
              <SortableTh onClick={() => onSort('missile-attack-penalty')} label="missile-attack-penalty" sort={sort} colKey="missile-attack-penalty" />
              <SortableTh onClick={() => onSort('quickness-penalty')} label="quickness-penalty" sort={sort} colKey="quickness-penalty" />
              <SortableTh onClick={() => onSort('animal-only')} label="animal-only" sort={sort} colKey="animal-only" />
              <SortableTh onClick={() => onSort('includes-greaves')} label="includes-greaves" sort={sort} colKey="includes-greaves" />
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 8 }}>actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={11} style={emptyCell}>No results.</td></tr>
            ) : (
              sorted.map((a) => (
                <tr key={a.id}>
                  <td style={tdStyle}>{a.id}</td>
                  <td style={tdStyle}>{a.name}</td>
                  <td style={tdStyle}>{a.type}</td>
                  <td style={tdStyle}>{a.description}</td>
                  <td style={tdStyle}>{a['min-manoeuvre-mod']}</td>
                  <td style={tdStyle}>{a['max-manoeuvre-mod']}</td>
                  <td style={tdStyle}>{a['missile-attack-penalty']}</td>
                  <td style={tdStyle}>{a['quickness-penalty']}</td>
                  <td style={tdStyle}>{String(a['animal-only'])}</td>
                  <td style={tdStyle}>{String(a['includes-greaves'])}</td>
                  <td style={tdStyle}>
                    <button onClick={() => startEdit(a)} style={{ marginRight: 6 }}>Edit</button>
                    <button onClick={() => onDelete(a)} style={{ color: '#b00020' }}>Delete</button>
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

function CheckboxInput({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
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

function emptyArmourtypeForm(): ArmourtypeFormState {
  return {
    id: '',
    name: '',
    type: '',
    description: '',
    minManoeuvreMod: 0,
    maxManoeuvreMod: 0,
    missileAttackPenalty: 0,
    quicknessPenalty: 0,
    animalOnly: false,
    includesGreaves: false,
  };
}