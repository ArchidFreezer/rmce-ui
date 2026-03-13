// src/endpoints/books/BooksView.jsx
import { useEffect, useMemo, useState } from 'react';
import { fetchBooks, upsertBook } from './api';

export default function BooksView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // search/sort
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

  // form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyBook());
  const [formErr, setFormErr] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const books = await fetchBooks();
        if (!mounted) return;
        setRows(books);
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
    return rows.filter(b =>
      [b.id, b.code, b.name, b.abbreviation, b.isbn]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      const av = (a?.[key] ?? '').toString();
      const bv = (b?.[key] ?? '').toString();
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  const onSort = (key) =>
    setSort(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const startNew = () => {
    setEditingId(null);
    setForm(emptyBook());
    setFormErr('');
    setShowForm(true);
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setForm({
      id: row.id ?? '',
      code: row.code ?? '',
      name: row.name ?? '',
      abbreviation: row.abbreviation ?? '',
      isbn: row.isbn ?? '',
    });
    setFormErr('');
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setFormErr('');
  };

  const validate = (b) => {
    if (!b.id?.trim()) return 'id is required';
    if (!b.name?.trim()) return 'name is required';
    if (!b.code?.trim()) return 'code is required';
    if (!b.abbreviation?.trim()) return 'abbreviation is required';
    if (!b.isbn?.trim()) return 'isbn is required';
    return '';
  };

  const saveForm = async () => {
    const payload = {
      id: form.id.trim(),
      code: form.code.trim(),
      name: form.name.trim(),
      abbreviation: form.abbreviation.trim(),
      isbn: form.isbn.trim(),
    };
    const msg = validate(payload);
    if (msg) { setFormErr(msg); return; }

    try {
      // Default: POST to collection path '/rmce/objects/book/'
      // If your server requires PUT /rmce/objects/book/{id}, change opts below:
      const opts = editingId
        ? { method: 'POST', useResourceIdPath: false } // or { method: 'PUT', useResourceIdPath: true }
        : { method: 'POST', useResourceIdPath: false };

      await upsertBook(payload, opts);

      // optimistic UI update
      setRows(prev => {
        const idx = prev.findIndex(b => b.id === payload.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...payload };
          return copy;
        }
        return [payload, ...prev];
      });

      setShowForm(false);
      setFormErr('');
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : String(err));
    }
  };

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Books</h2>

      {/* Create / Edit Bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
        <button onClick={startNew}>New Book</button>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search books…"
          style={{ padding: 8, width: 360, maxWidth: '100%' }}
          aria-label="Search books"
        />
      </div>

      {/* Form Panel */}
      {showForm && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16, background: '#fafafa' }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Book' : 'New Book'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <LabeledInput label="ID" value={form.id} onChange={v => setForm(s => ({ ...s, id: v }))} disabled={!!editingId} />
            <LabeledInput label="Code" value={form.code} onChange={v => setForm(s => ({ ...s, code: v }))} />
            <LabeledInput label="Name" value={form.name} onChange={v => setForm(s => ({ ...s, name: v }))} />
            <LabeledInput label="Abbreviation" value={form.abbreviation} onChange={v => setForm(s => ({ ...s, abbreviation: v }))} />
            <LabeledInput label="ISBN" value={form.isbn} onChange={v => setForm(s => ({ ...s, isbn: v }))} />
          </div>
          {formErr && <div style={{ color: 'crimson', marginTop: 8 }}>{formErr}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveForm}>Save</button>
            <button onClick={cancelForm} type="button">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 900, width: '100%' }}>
          <thead>
            <tr>
              <SortableTh onClick={() => onSort('id')} label="id" sort={sort} colKey="id" />
              <SortableTh onClick={() => onSort('code')} label="code" sort={sort} colKey="code" />
              <SortableTh onClick={() => onSort('name')} label="name" sort={sort} colKey="name" />
              <SortableTh onClick={() => onSort('abbreviation')} label="abbreviation" sort={sort} colKey="abbreviation" />
              <SortableTh onClick={() => onSort('isbn')} label="isbn" sort={sort} colKey="isbn" />
              <th style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: 8 }}>actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={6} style={emptyCell}>No results.</td></tr>
            ) : (
              sorted.map((b, idx) => (
                <tr key={b.id ?? idx}>
                  <td style={tdStyle}>{b.id}</td>
                  <td style={tdStyle}>{b.code}</td>
                  <td style={tdStyle}>{b.name}</td>
                  <td style={tdStyle}>{b.abbreviation}</td>
                  <td style={tdStyle}>{b.isbn}</td>
                  <td style={tdStyle}>
                    <button onClick={() => startEdit(b)}>Edit</button>
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

function LabeledInput({ label, value, onChange, type = 'text', disabled = false }) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>
      <span>{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        type={type}
        disabled={disabled}
        style={{ padding: 8 }}
      />
    </label>
  );
}

function SortableTh({ onClick, label, sort, colKey }) {
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

const tdStyle = { borderBottom: '1px solid #f0f0f0', padding: '8px' };
const emptyCell = { padding: 12, textAlign: 'center', color: '#666' };

function emptyBook() {
  return { id: '', code: '', name: '', abbreviation: '', isbn: '' };
}