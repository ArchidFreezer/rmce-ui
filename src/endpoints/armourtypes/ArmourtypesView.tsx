import { useEffect, useMemo, useState } from 'react';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import { fetchArmourtypes, upsertArmourtype, deleteArmourtype } from './api';
import type { Armourtype } from '../../types';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

type ArmourNumberKey =
  | 'minManoeuvreMod'
  | 'maxManoeuvreMod'
  | 'missileAttackPenalty'
  | 'quicknessPenalty';

type ArmourBooleanKey = 'animalOnly' | 'includesGreaves';
type ArmourStringKey = Exclude<keyof Armourtype, ArmourNumberKey | ArmourBooleanKey>;

const NUM_KEYS: ArmourNumberKey[] = [
  'minManoeuvreMod',
  'maxManoeuvreMod',
  'missileAttackPenalty',
  'quicknessPenalty',
];

export default function ArmourtypesView() {
  const [rows, setRows] = useState<Armourtype[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');

  const globalFilter = (a: Armourtype, q: string) => {
  const s = q.toLowerCase();
    return [
      a.id, a.name, a.type, a.description,
      a.minManoeuvreMod, a.maxManoeuvreMod,
      a.missileAttackPenalty, a.quicknessPenalty,
      a.animalOnly, a.includesGreaves,
    ].some(v => String(v ?? '').toLowerCase().includes(s));
  };

  const columns: ColumnDef<Armourtype>[] = [
    { id: 'id', header: 'id', accessor: r => r.id },
    { id: 'name', header: 'name', accessor: r => r.name },
    { id: 'type', header: 'type', accessor: r => r.type },
    { id: 'description', header: 'description', accessor: r => r.description },
    { id: 'minManoeuvreMod', header: 'minManoeuvreMod', accessor: r => r.minManoeuvreMod, sortType: 'number', align: 'right' },
    { id: 'maxManoeuvreMod', header: 'maxManoeuvreMod', accessor: r => r.maxManoeuvreMod, sortType: 'number', align: 'right' },
    { id: 'missileAttackPenalty', header: 'missileAttackPenalty', accessor: r => r.missileAttackPenalty, sortType: 'number', align: 'right' },
    { id: 'quicknessPenalty', header: 'quicknessPenalty', accessor: r => r.quicknessPenalty, sortType: 'number', align: 'right' },
    { id: 'animalOnly', header: 'animalOnly', accessor: r => r.animalOnly, sortType: 'boolean', align: 'center' },
    { id: 'includesGreaves', header: 'includesGreaves', accessor: r => r.includesGreaves, sortType: 'boolean', align: 'center' },
    {
      id: 'actions',
      header: 'actions',
      sortable: false,
      render: (row) => (
        <>
          <button onClick={() => startEdit(row)} style={{ marginRight: 6 }}>Edit</button>
          <button onClick={() => onDelete(row)} style={{ color: '#b00020' }}>Delete</button>
        </>
      ),
    },
  ];

  const [sort, setSort] = useState<{ key: keyof Armourtype; dir: 'asc' | 'desc' }>({
    key: 'name',
    dir: 'asc',
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Armourtype>(emptyArmourtype()); // single interface pattern
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
        a.id, a.name, a.type, a.description,
        a.minManoeuvreMod, a.maxManoeuvreMod,
        a.missileAttackPenalty, a.quicknessPenalty,
        a.animalOnly, a.includesGreaves,
      ]
      .map(v => String(v ?? '').toLowerCase())
      .some(s => s.includes(q))
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;

    const isNumberKey = (k: keyof Armourtype): k is ArmourNumberKey =>
      NUM_KEYS.includes(k as ArmourNumberKey);
    const isBooleanKey = (k: keyof Armourtype): k is ArmourBooleanKey =>
      k === 'animalOnly' || k === 'includesGreaves';

    arr.sort((a, b) => {
      if (isNumberKey(key)) {
        const av = a[key] as number;
        const bv = b[key] as number;
        return dir === 'asc' ? av - bv : bv - av;
      }
      if (isBooleanKey(key)) {
        const av = a[key] as boolean;
        const bv = b[key] as boolean;
        return dir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
      }
      const av = String(a[key as ArmourStringKey] ?? '');
      const bv = String(b[key as ArmourStringKey] ?? '');
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });

    return arr;
  }, [filtered, sort]);

  const onSort = (key: keyof Armourtype) =>
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

  const startNew = () => {
    setEditingId(null);
    setForm(emptyArmourtype());
    setFormErr('');
    setShowForm(true);
  };

  const startEdit = (row: Armourtype) => {
    setEditingId(row.id);
    setForm({ ...row });
    setFormErr('');
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setFormErr('');
  };

  const validate = (f: Armourtype): string => {
    if (!f.id?.trim()) return 'id is required';
    if (!f.name?.trim()) return 'name is required';
    if (!f.type?.trim()) return 'type is required';
    for (const k of NUM_KEYS) {
      const raw = getNumInput(f, k);
      if (raw === '' || Number.isNaN(Number(raw))) return `${k} must be a number`;
    }
    return '';
  };

  const saveForm = async () => {
    const msg = validate(form);
    if (msg) {
      setFormErr(msg);
      return;
    }

    // Normalize payload (strings -> numbers for numeric fields)
    const payload: Armourtype = {
      id: String(form.id).trim(),
      name: String(form.name).trim(),
      type: String(form.type).trim(),
      description: String(form.description ?? ''),
      minManoeuvreMod: Number(getNumInput(form, 'minManoeuvreMod')),
      maxManoeuvreMod: Number(getNumInput(form, 'maxManoeuvreMod')),
      missileAttackPenalty: Number(getNumInput(form, 'missileAttackPenalty')),
      quicknessPenalty: Number(getNumInput(form, 'quicknessPenalty')),
      animalOnly: Boolean(form.animalOnly),
      includesGreaves: Boolean(form.includesGreaves),
    };

    try {
      const opts = editingId
        ? { method: 'POST' as const, useResourceIdPath: false } // or PUT+id if your API prefers
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
        <DataTableSearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search armourtypes…"
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

            <LabeledInput
              label="Min Manoeuvre Mod"
              type="number"
              value={getNumInput(form, 'minManoeuvreMod')}
              onChange={(v) => setNumFromInput('minManoeuvreMod', v)}
            />
            <LabeledInput
              label="Max Manoeuvre Mod"
              type="number"
              value={getNumInput(form, 'maxManoeuvreMod')}
              onChange={(v) => setNumFromInput('maxManoeuvreMod', v)}
            />
            <LabeledInput
              label="Missile Attack Penalty"
              type="number"
              value={getNumInput(form, 'missileAttackPenalty')}
              onChange={(v) => setNumFromInput('missileAttackPenalty', v)}
            />
            <LabeledInput
              label="Quickness Penalty"
              type="number"
              value={getNumInput(form, 'quicknessPenalty')}
              onChange={(v) => setNumFromInput('quicknessPenalty', v)}
            />

            <CheckboxInput
              label="Animal Only"
              checked={form.animalOnly}
              onChange={(c) => setForm(s => ({ ...s, animalOnly: c }))}
            />
            <CheckboxInput
              label="Includes Greaves"
              checked={form.includesGreaves}
              onChange={(c) => setForm(s => ({ ...s, includesGreaves: c }))}
            />
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
              <SortableTh onClick={() => onSort('minManoeuvreMod')} label="minManoeuvreMod" sort={sort} colKey="minManoeuvreMod" />
              <SortableTh onClick={() => onSort('maxManoeuvreMod')} label="maxManoeuvreMod" sort={sort} colKey="maxManoeuvreMod" />
              <SortableTh onClick={() => onSort('missileAttackPenalty')} label="missileAttackPenalty" sort={sort} colKey="missileAttackPenalty" />
              <SortableTh onClick={() => onSort('quicknessPenalty')} label="quicknessPenalty" sort={sort} colKey="quicknessPenalty" />
              <SortableTh onClick={() => onSort('animalOnly')} label="animalOnly" sort={sort} colKey="animalOnly" />
              <SortableTh onClick={() => onSort('includesGreaves')} label="includesGreaves" sort={sort} colKey="includesGreaves" />
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
                  <td style={tdStyle}>{a.minManoeuvreMod}</td>
                  <td style={tdStyle}>{a.maxManoeuvreMod}</td>
                  <td style={tdStyle}>{a.missileAttackPenalty}</td>
                  <td style={tdStyle}>{a.quicknessPenalty}</td>
                  <td style={tdStyle}>{String(a.animalOnly)}</td>
                  <td style={tdStyle}>{String(a.includesGreaves)}</td>
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

      <DataTable<Armourtype>
        rows={rows}
        columns={columns}
        rowId={(r) => r.id}
        initialSort={{ colId: 'name', dir: 'asc' }}
        searchQuery={query}
        globalFilter={globalFilter}
        tableMinWidth={1200}
        zebra
      />
    </>
  );


  /** ----------------- Numeric input helpers (single-interface form) ----------------- */

  function getNumInput(obj: Armourtype, key: ArmourNumberKey): string {
    const anyObj = obj as Armourtype & { __raw?: Record<string, string> };
    const raw = anyObj.__raw?.[key];
    if (raw !== undefined) return raw;
    return String(obj[key] ?? '');
  }

  function setNumFromInput(key: ArmourNumberKey, value: string) {
    setForm((s) => {
      const next = { ...s } as Armourtype & { __raw?: Record<string, string> };
      next.__raw = { ...(next.__raw ?? {}), [key]: value };
      const maybe = Number(value);
      if (!Number.isNaN(maybe)) {
        (next as Armourtype)[key] = maybe;
      }
      return next as Armourtype;
    });
  }
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
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
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

function emptyArmourtype(): Armourtype {
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