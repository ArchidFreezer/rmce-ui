// src/endpoints/books/BooksView.jsx
import { useEffect, useMemo, useState } from 'react';
import { fetchBooks } from './api';

export default function BooksView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

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

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Books</h2>
      <div style={{ margin: '12px 0' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search books…"
          style={{ padding: 8, width: 360, maxWidth: '100%' }}
          aria-label="Search books"
        />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 800, width: '100%' }}>
          <thead>
            <tr>
              <SortableTh onClick={() => onSort('id')} label="id" sort={sort} colKey="id" />
              <SortableTh onClick={() => onSort('code')} label="code" sort={sort} colKey="code" />
              <SortableTh onClick={() => onSort('name')} label="name" sort={sort} colKey="name" />
              <SortableTh onClick={() => onSort('abbreviation')} label="abbreviation" sort={sort} colKey="abbreviation" />
              <SortableTh onClick={() => onSort('isbn')} label="isbn" sort={sort} colKey="isbn" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={5} style={emptyCell}>No results.</td></tr>
            ) : (
              sorted.map((b, idx) => (
                <tr key={b.id ?? idx}>
                  <td style={tdStyle}>{b.id}</td>
                  <td style={tdStyle}>{b.code}</td>
                  <td style={tdStyle}>{b.name}</td>
                  <td style={tdStyle}>{b.abbreviation}</td>
                  <td style={tdStyle}>{b.isbn}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
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