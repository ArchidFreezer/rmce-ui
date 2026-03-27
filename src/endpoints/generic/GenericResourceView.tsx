import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchJson } from '../../api/client';
import { DataTable, DataTableSearchInput, type ColumnDef } from '../../components/DataTable';

type AnyRecord = Record<string, unknown>;

export default function GenericResourceView() {
  const { prefix } = useParams<{ prefix: string }>();
  const [payload, setPayload] = useState<unknown>(null);
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [arrayKey, setArrayKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // table UX
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showRaw, setShowRaw] = useState(false);

  const title = prefixTitle(prefix);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!prefix) return;
      setLoading(true);
      setError(null);
      try {
        // Generic API: GET /rmce/objects/{prefix}
        const data = await fetchJson(`/rmce/objects/${encodeURIComponent(prefix)}`);
        if (!mounted) return;
        setPayload(data);

        const { arr, key } = extractArray(data);
        setItems(arr);
        setArrayKey(key);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
        setPayload(null);
        setItems([]);
        setArrayKey(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [prefix]);

  // Columns: infer from the first N rows (use 100 to keep it snappy)
  const columns = useMemo<ColumnDef<AnyRecord>[]>(() => {
    if (!items.length) return [];
    const MAX_SCAN = 100;
    const sample = items.slice(0, MAX_SCAN);

    const keySet = new Set<string>();
    for (const row of sample) {
      Object.keys(row ?? {}).forEach(k => keySet.add(k));
    }

    // Build a column for each key; left-align strings/ids, right-align numbers
    const cols: ColumnDef<AnyRecord>[] = Array.from(keySet).map((key) => {
      const { sortType, align } = guessColumnMeta(sample, key);
      return {
        id: key,
        header: key,
        accessor: (r) => r?.[key],
        sortType,
        align,
        // optional defaults; users can resize
        minWidth: 100,
      };
    });

    // Add an actions column with "view JSON" copy button if you want later
    return cols;
  }, [items]);

  const globalFilter = (row: AnyRecord, q: string) => {
    const s = q.toLowerCase();
    for (const v of Object.values(row)) {
      if (String(v ?? '').toLowerCase().includes(s)) return true;
    }
    return false;
  };

  const refresh = () => {
    // force re-run of effect by nudging prefix or separate state; simplest is:
    setLoading(true);
    // quickly re-use the effect by setting prefix dependency implicitly; or:
    // (re-run code)
    (async () => {
      try {
        const data = await fetchJson(`/rmce/objects/${encodeURIComponent(prefix ?? '')}`);
        setPayload(data);
        const { arr, key } = extractArray(data);
        setItems(arr);
        setArrayKey(key);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPayload(null);
        setItems([]);
        setArrayKey(null);
      } finally {
        setLoading(false);
      }
    })();
  };

  if (!prefix) return <div>Missing resource prefix.</div>;
  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'crimson' }}>Error: {error}</div>;

  return (
    <>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {title}
        <small style={{ color: 'var(--muted)' }}>
          {arrayKey ? `(${arrayKey})` : items.length ? '(array)' : '(no array found)'}
        </small>
      </h2>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
        <button onClick={refresh}>Refresh</button>
        <DataTableSearchInput
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder={`Search ${title.toLowerCase()}…`}
          aria-label={`Search ${title}`}
        />
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <input type="checkbox" checked={showRaw} onChange={() => setShowRaw(v => !v)} />
          Show raw JSON
        </label>
      </div>

      {/* Raw JSON toggle */}
      {showRaw && (
        <pre style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: 12, borderRadius: 8, overflow: 'auto' }}>
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}

      {/* Auto-inferred table */}
      <DataTable<AnyRecord>
        rows={items}
        columns={columns}
        rowId={(_, idx) => String(idx)}
        // sorting
        initialSort={null}
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
        // fit + theming/UX
        tableMinWidth={0}
        zebra
        hover
        resizable
        persistKey={`dt.generic.${prefix}.v1`}
        ariaLabel={`${title} data`}
      />

      {!items.length && (
        <div style={{ marginTop: 8, color: 'var(--muted)' }}>
          No array data detected. Ensure your endpoint returns an array at the root or an array property.
        </div>
      )}
    </>
  );
}

/* --------------- Helpers ---------------- */

function extractArray(data: unknown): { arr: AnyRecord[]; key: string | null } {
  if (Array.isArray(data)) {
    return { arr: coerceArrayOfObjects(data), key: null };
  }
  if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        return { arr: coerceArrayOfObjects(v), key: k };
      }
    }
  }
  return { arr: [], key: null };
}

function coerceArrayOfObjects(arr: unknown[]): AnyRecord[] {
  return arr.map((x) => (x && typeof x === 'object' ? (x as AnyRecord) : { value: x }));
}

function guessColumnMeta(sample: AnyRecord[], key: string): { sortType: 'auto' | 'string' | 'number' | 'boolean'; align: 'left' | 'center' | 'right' } {
  // Check sample values to guess the best sort and alignment
  let nums = 0, bools = 0, total = 0;
  for (const r of sample) {
    const v = r?.[key];
    if (v === null || v === undefined) continue;
    total++;
    if (typeof v === 'number') nums++;
    else if (typeof v === 'boolean') bools++;
  }
  if (nums > bools && nums > 0) return { sortType: 'number', align: 'right' };
  if (bools >= nums && bools > 0) return { sortType: 'boolean', align: 'center' };
  return { sortType: 'string', align: 'left' };
}

function prefixTitle(prefix?: string) {
  if (!prefix) return 'Resource';
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}
