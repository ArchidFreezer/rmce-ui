// src/App.jsx
import { useEffect, useMemo, useState } from 'react'
import { fetchBooksPayload, fetchPoisonsPayload } from './api'
import './App.css'

function App() {
  const [tab, setTab] = useState('books') // 'books' | 'poisons'

  return (
    <div style={{ padding: 16 }}>
      <h1>RMCE Objects</h1>

      <nav style={{ display: 'flex', gap: 8, margin: '12px 0 20px' }}>
        <TabButton active={tab === 'books'} onClick={() => setTab('books')}>Books</TabButton>
        <TabButton active={tab === 'poisons'} onClick={() => setTab('poisons')}>Poisons</TabButton>
      </nav>

      {tab === 'books' ? <BooksView /> : <PoisonsView />}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 12px',
        borderRadius: 6,
        border: active ? '1px solid #4a90e2' : '1px solid #ccc',
        background: active ? '#e8f2ff' : '#f7f7f7',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

/* ----------------- Books ----------------- */

function BooksView() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { books } = await fetchBooksPayload()
        if (!mounted) return
        setBooks(books)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return books
    return books.filter(b =>
      [b.id, b.code, b.name, b.abbreviation, b.isbn]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    )
  }, [books, query])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    const { key, dir } = sort
    arr.sort((a, b) => {
      const av = (a?.[key] ?? '').toString()
      const bv = (b?.[key] ?? '').toString()
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [filtered, sort])

  const onSort = (key) =>
    setSort(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  if (loading) return <div>Loading…</div>
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>

  return (
    <>
      <h2>Books</h2>
      <SearchBox value={query} onChange={setQuery} placeholder="Search books…" />

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
  )
}

/* ----------------- Poisons ----------------- */

function PoisonsView() {
  const [poisons, setPoisons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' }) // default sort

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { poisons } = await fetchPoisonsPayload()
        if (!mounted) return
        setPoisons(poisons)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return poisons
    return poisons.filter(p =>
      [p.id, p.name, p.type, p.level, p?.['level-variance']]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    )
  }, [poisons, query])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    const { key, dir } = sort
    arr.sort((a, b) => {
      const av = a?.[key] ?? (key === 'level-variance' ? a?.['level-variance'] : '')
      const bv = b?.[key] ?? (key === 'level-variance' ? b?.['level-variance'] : '')
      // Numeric sort if key is level
      if (key === 'level') {
        const na = Number(av) || 0
        const nb = Number(bv) || 0
        return dir === 'asc' ? na - nb : nb - na
      }
      const as = String(av)
      const bs = String(bv)
      if (as < bs) return dir === 'asc' ? -1 : 1
      if (as > bs) return dir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [filtered, sort])

  const onSort = (key) =>
    setSort(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  if (loading) return <div>Loading…</div>
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>

  return (
    <>
      <h2>Poisons</h2>
      <SearchBox value={query} onChange={setQuery} placeholder="Search poisons…" />

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 900, width: '100%' }}>
          <thead>
            <tr>
              <SortableTh onClick={() => onSort('id')} label="id" sort={sort} colKey="id" />
              <SortableTh onClick={() => onSort('name')} label="name" sort={sort} colKey="name" />
              <SortableTh onClick={() => onSort('type')} label="type" sort={sort} colKey="type" />
              <SortableTh onClick={() => onSort('level')} label="level" sort={sort} colKey="level" />
              <SortableTh onClick={() => onSort('level-variance')} label="level-variance" sort={sort} colKey="level-variance" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={5} style={emptyCell}>No results.</td></tr>
            ) : (
              sorted.map((p, idx) => (
                <tr key={p.id ?? idx}>
                  <td style={tdStyle}>{p.id}</td>
                  <td style={tdStyle}>{p.name}</td>
                  <td style={tdStyle}>{p.type}</td>
                  <td style={tdStyle}>{p.level}</td>
                  <td style={tdStyle}>{p?.['level-variance']}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ----------------- Shared UI pieces ----------------- */

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div style={{ margin: '12px 0' }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ padding: 8, width: 360, maxWidth: '100%' }}
        aria-label={placeholder}
      />
    </div>
  )
}

function SortableTh({ onClick, label, sort, colKey }) {
  const active = sort.key === colKey
  const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''
  return (
    <th
      onClick={onClick}
      style={{ borderBottom: '1px solid #ddd', textAlign: 'left', padding: '8px', cursor: 'pointer', userSelect: 'none' }}
      title={`Sort by ${label}`}
      scope="col"
    >
      {label}{arrow}
    </th>
  )
}

const tdStyle = { borderBottom: '1px solid #f0f0f0', padding: '8px' }
const emptyCell = { padding: 12, textAlign: 'center', color: '#666' }

export default App