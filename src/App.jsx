import { useEffect, useMemo, useState } from 'react'
import { fetchBooksPayload } from './api'
import './App.css'

function App() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' }) // default sort by name

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
    return () => {
      mounted = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return books
    return books.filter(b => {
      return [
        b.id,
        b.code,
        b.name,
        b.abbreviation,
        b.isbn
      ].some(val => String(val || '').toLowerCase().includes(q))
    })
  }, [books, query])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    const { key, dir } = sort
    arr.sort((a, b) => {
      const av = a?.[key] ?? ''
      const bv = b?.[key] ?? ''
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [filtered, sort])

  const onSort = (key) => {
    setSort(prev => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { key, dir: 'asc' }
    })
  }

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>
  if (error) return <div style={{ color: 'crimson', padding: 16 }}>Error: {error}</div>

  return (
    <div style={{ padding: 16 }}>
      <h1>Books</h1>

      <div style={{ margin: '12px 0' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, code, abbreviation, ISBN, or id…"
          style={{ padding: 8, width: 360, maxWidth: '100%' }}
          aria-label="Search books"
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 800 }}>
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
              <tr>
                <td colSpan={5} style={{ padding: 12, textAlign: 'center', color: '#666' }}>
                  No results.
                </td>
              </tr>
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
    </div>
  )
}

const tdStyle = { borderBottom: '1px solid #f0f0f0', padding: '8px' }

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

export default App