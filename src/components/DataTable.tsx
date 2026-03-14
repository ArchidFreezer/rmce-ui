import React, { useEffect, useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

export interface SortState {
  colId: string;
  dir: SortDir;
}

export type SortType<T> =
  | 'auto'
  | 'string'
  | 'number'
  | 'boolean'
  | ((a: T, b: T) => number);

export interface ColumnDef<T> {
  /** Unique column id */
  id: string;
  /** Header label (or custom) */
  header: React.ReactNode;
  /** Extracts a value for sorting and default cell render */
  accessor?: (row: T) => unknown;
  /** Custom cell renderer if you don’t want default rendering */
  render?: (row: T, rowIndex: number) => React.ReactNode;
  /** Is this column sortable? (defaults to true if accessor is provided) */
  sortable?: boolean;
  /** How to sort values in this column */
  sortType?: SortType<T>;
  /** Alignment of cell content */
  align?: 'left' | 'center' | 'right';
  /** Optional width (px, %, etc.) */
  width?: number | string;
  /** Optional title for <th> tooltip */
  headerTitle?: string;
}

export interface DataTableProps<T> {
  /** Data rows (for server mode, rows of the current page) */
  rows: T[];
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Unique id extractor for each row */
  rowId: (row: T, index: number) => string;
  // ---- Sorting ----
  /** Initial sort (uncontrolled) */
  initialSort?: SortState | null;
  /** Controlled sort (pass + onSortChange for controlled mode) */
  sort?: SortState | null;
  /** Controlled sort change callback */
  onSortChange?: (s: SortState | null) => void;
  // ---- Search (global) ----
  /** Optional global search query (you manage the input) */
  searchQuery?: string;
  /** How to filter rows for the global search query */
  globalFilter?: (row: T, query: string) => boolean;

  // ---- Pagination ----
  /** 'client' paginates after filtering/sorting; 'server' expects rows are already paged and uses totalRows for controls */
  mode?: 'client' | 'server';
  /** Controlled: current page (1-based) */
  page?: number;
  /** Controlled: page size */
  pageSize?: number;
  /** Controlled: total rows (server mode), or override client total for custom needs */
  totalRows?: number;
  /** Uncontrolled defaults */
  initialPage?: number;
  initialPageSize?: number;
  /** Controlled change callbacks */
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** Page size options for the selector */
  pageSizeOptions?: number[];
  /** Show the built-in pagination bar (default true) */
  showPagination?: boolean;

  // ---- Misc ----
  emptyMessage?: string;
  /** Min width for horizontal scroll */
  tableMinWidth?: number;
  /** Dense row height */
  dense?: boolean;
  /** Zebra striping */
  zebra?: boolean;
  /** Optional table ARIA label */
  ariaLabel?: string;
}

/** Simple input you can reuse with the table */
export function DataTableSearchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        padding: 8,
        width: 360,
        maxWidth: '100%',
        ...(props.style || {}),
      }}
    />
  );
}

export function DataTable<T>({
  rows,
  columns,
  rowId,
  // sort
  initialSort = null,
  sort: sortProp,
  onSortChange,
  // search
  searchQuery,
  globalFilter,
  // pagination
  mode = 'client',
  page: pageProp,
  pageSize: pageSizeProp,
  totalRows: totalRowsProp,
  initialPage = 1,
  initialPageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50, 100],
  showPagination = true,
  // misc
  emptyMessage = 'No results.',
  tableMinWidth = 800,
  dense = false,
  zebra = false,
  ariaLabel,
}: DataTableProps<T>) {
  // ---- Uncontrolled states ----
  const [innerSort, setInnerSort] = useState<SortState | null>(initialSort);
  const [innerPage, setInnerPage] = useState<number>(initialPage);
  const [innerPageSize, setInnerPageSize] = useState<number>(initialPageSize);

  // Controlled or uncontrolled
  const sortState = sortProp !== undefined ? sortProp : innerSort;
  const page = pageProp ?? innerPage;
  const pageSize = pageSizeProp ?? innerPageSize;

  // ---- Filter ----
  const filtered = useMemo(() => {
    if (!searchQuery || !globalFilter) return rows;
    const q = searchQuery.trim();
    if (!q) return rows;
    return rows.filter((r) => {
      try {
        return globalFilter(r, q);
      } catch {
        return true;
      }
    });
  }, [rows, searchQuery, globalFilter]);

  // ---- Sort ----
  const sorted = useMemo(() => {
    if (!sortState) return filtered;
    const col = columns.find((c) => c.id === sortState.colId);
    if (!col) return filtered;

    const sortable = col.sortable ?? !!col.accessor;
    if (!sortable) return filtered;

    const dir = sortState.dir;
    const sortType = col.sortType ?? 'auto';
    const getVal = (r: T) => (col.accessor ? col.accessor(r) : undefined);

    const cmp = (() => {
      if (typeof sortType === 'function') {
        return (a: T, b: T) => sortType(a, b);
      }
      if (sortType === 'number') {
        return (a: T, b: T) => (Number(getVal(a)) || 0) - (Number(getVal(b)) || 0);
      }
      if (sortType === 'boolean') {
        return (a: T, b: T) => Number(Boolean(getVal(a))) - Number(Boolean(getVal(b)));
      }
      if (sortType === 'string') {
        return (a: T, b: T) => {
          const av = String(getVal(a) ?? '');
          const bv = String(getVal(b) ?? '');
          return av.localeCompare(bv);
        };
      }
      // auto: try number → boolean → string
      return (a: T, b: T) => {
        const av = getVal(a);
        const bv = getVal(b);
        const an = Number(av);
        const bn = Number(bv);
        if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
        const as = String(av ?? '');
        const bs = String(bv ?? '');
        return as.localeCompare(bs);
      };
    })();

    const arr = [...filtered];
    arr.sort((a, b) => {
      const r = cmp(a, b);
      return dir === 'asc' ? r : -r;
    });
    return arr;
  }, [filtered, sortState, columns]);

  // ---- Total and paged rows ----
  const totalRows = mode === 'server' ? (totalRowsProp ?? rows.length) : sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / Math.max(1, pageSize)));

  // Clamp page whenever dependencies change
  useEffect(() => {
    const clamped = Math.min(Math.max(1, page), totalPages);
    if (clamped !== page) {
      if (onPageChange) onPageChange(clamped);
      else setInnerPage(clamped);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages, page, onPageChange]);

  // Reset to page 1 when search query changes (common UX)
  useEffect(() => {
    if (!searchQuery) return;
    if (onPageChange) onPageChange(1);
    else setInnerPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Compute page slice for client mode
  const pagedRows = useMemo(() => {
    if (mode === 'server') return sorted; // assume server already paginated
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return sorted.slice(start, end);
  }, [sorted, mode, page, pageSize]);

  const handleHeaderClick = (col: ColumnDef<T>) => {
    const sortable = col.sortable ?? !!col.accessor;
    if (!sortable) return;
    const next = (() => {
      if (!sortState || sortState.colId !== col.id) return { colId: col.id, dir: 'asc' as SortDir };
      return { colId: col.id, dir: sortState.dir === 'asc' ? 'desc' : 'asc' as SortDir };
    })();

    if (onSortChange) onSortChange(next);
    else setInnerSort(next);
  };

  const fromRow = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRow = totalRows === 0 ? 0 : Math.min(page * pageSize, totalRows);

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{ borderCollapse: 'collapse', minWidth: tableMinWidth, width: '100%' }}
          aria-label={ariaLabel}
        >
          <thead>
            <tr>
              {columns.map((c) => {
                const sortable = c.sortable ?? !!c.accessor;
                const active = sortState?.colId === c.id;
                const arrow = active ? (sortState?.dir === 'asc' ? ' ▲' : ' ▼') : '';
                return (
                  <th
                    key={c.id}
                    title={c.headerTitle ?? (typeof c.header === 'string' ? c.header : undefined)}
                    onClick={() => handleHeaderClick(c)}
                    style={{
                      borderBottom: '1px solid #ddd',
                      textAlign: c.align ?? 'left',
                      padding: dense ? '6px' : '8px',
                      userSelect: 'none',
                      cursor: sortable ? 'pointer' : 'default',
                      width: c.width,
                      whiteSpace: 'nowrap',
                    }}
                    scope="col"
                  >
                    {c.header}{sortable ? arrow : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {(mode === 'client' ? pagedRows : sorted).length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 12, textAlign: 'center', color: '#666' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              (mode === 'client' ? pagedRows : sorted).map((row, idx) => {
                const key = rowId(row, idx);
                return (
                  <tr
                    key={key}
                    style={{
                      background: zebra && idx % 2 === 1 ? '#fafafa' : undefined,
                    }}
                  >
                    {columns.map((c) => {
                      const content =
                        c.render
                          ? c.render(row, idx)
                          : String(c.accessor ? c.accessor(row) ?? '' : '');
                      return (
                        <td
                          key={c.id}
                          style={{
                            borderBottom: '1px solid #f0f0f0',
                            padding: dense ? '6px' : '8px',
                            textAlign: c.align ?? 'left',
                            verticalAlign: 'top',
                          }}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <div style={{ marginTop: 8 }}>
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalRows={totalRows}
            totalPages={totalPages}
            pageSizeOptions={pageSizeOptions}
            onPageChange={(p) => {
              if (onPageChange) onPageChange(p);
              else setInnerPage(p);
            }}
            onPageSizeChange={(ps) => {
              if (onPageSizeChange) onPageSizeChange(ps);
              else setInnerPageSize(ps);
              // When page size changes, go to first page
              if (onPageChange) onPageChange(1);
              else setInnerPage(1);
            }}
            fromRow={fromRow}
            toRow={toRow}
          />
        </div>
      )}
    </>
  );
}

/** ---- Pagination Control ---- */

export function DataTablePagination({
  page,
  pageSize,
  totalRows,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50, 100],
  fromRow,
  toRow,
}: {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  fromRow: number;
  toRow: number;
}) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div
      role="navigation"
      aria-label="Table pagination"
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
      }}
    >
      {/* Left: page size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ fontSize: 14 }}>
          Rows per page:{' '}
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{ padding: '4px 8px' }}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Middle: range info */}
      <div style={{ fontSize: 14, color: '#333' }}>
        {totalRows === 0
          ? '0–0 of 0'
          : `${fromRow}–${toRow} of ${totalRows}`}
      </div>

      {/* Right: controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => onPageChange(1)}
          disabled={!canPrev}
          aria-label="First page"
          style={{ padding: '4px 8px' }}
        >
          « First
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          aria-label="Previous page"
          style={{ padding: '4px 8px' }}
        >
          ‹ Prev
        </button>
        <span style={{ minWidth: 90, textAlign: 'center', fontSize: 14 }}>
          Page {Math.min(page, totalPages)} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          aria-label="Next page"
          style={{ padding: '4px 8px' }}
        >
          Next ›
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={!canNext}
          aria-label="Last page"
          style={{ padding: '4px 8px' }}
        >
          Last »
        </button>
      </div>
    </div>
  );
}