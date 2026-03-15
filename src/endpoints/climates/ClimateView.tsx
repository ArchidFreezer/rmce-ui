// src/endpoints/climate/ClimateView.tsx
import { useEffect, useMemo, useState } from 'react';
import { fetchClimates } from '../../api/climate';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';
import type { Climate } from '../../types';

export default function ClimateView() {
  const [rows, setRows] = useState<Climate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // table UX
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

    return [
      {
        id: 'id',
        header: 'id',
        accessor: (r) => r.id,
        sortType: 'string',
        minWidth: 220,
      },
      {
        id: 'name',
        header: 'name',
        accessor: (r) => r.name,
        sortType: 'string',
        minWidth: 180,
      },
      {
        id: 'temperature',
        header: 'temperature',
        accessor: (r) => r.temperature,
        sortType: 'string',
        minWidth: 140,
      },
      {
        id: 'precipitations',
        header: 'precipitations',
        // Make sortable by joined string for stable ordering
        accessor: (r) => r.precipitations.join(', '),
        sortType: 'string',
        minWidth: 220,
        render: (r) => (
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {r.precipitations.length === 0 ? <span style={{ color: 'var(--muted)' }}>—</span> : r.precipitations.map(chip)}
          </div>
        ),
      },
    ];
  }, []);

  // Global filter across all fields (including precipitation items)
  const globalFilter = (r: Climate, q: string) => {
    const s = q.toLowerCase();
    if (r.id.toLowerCase().includes(s)) return true;
    if (r.name.toLowerCase().includes(s)) return true;
    if (r.temperature.toLowerCase().includes(s)) return true;
    if (r.precipitations.some((p) => p.toLowerCase().includes(s))) return true;
    return false;
  };

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2>Climates</h2>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
        <DataTableSearchInput
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="Search climates…"
          aria-label="Search climates"
        />
      </div>

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
        tableMinWidth={0}  // fit viewport
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
