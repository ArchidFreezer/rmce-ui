import React, { useMemo, useState } from 'react';

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
  /** Data rows */
  rows: T[];
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Unique id extractor for each row */
  rowId: (row: T, index: number) => string;
  /** Initial sort (uncontrolled) */
  initialSort?: SortState | null;
  /** Controlled sort (pass + onSortChange for controlled mode) */
  sort?: SortState | null;
  /** Controlled sort change callback */
  onSortChange?: (s: SortState | null) => void;
  /** Optional global search query (you manage the input) */
  searchQuery?: string;
  /** How to filter rows for the global search query */
  globalFilter?: (row: T, query: string) => boolean;
  /** When no rows after filter */
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
  initialSort = null,
  sort: sortProp,
  onSortChange,
  searchQuery,
  globalFilter,
  emptyMessage = 'No results.',
  tableMinWidth = 800,
  dense = false,
  zebra = false,
  ariaLabel,
}: DataTableProps<T>) {
  // Uncontrolled sort state
  const [innerSort, setInnerSort] = useState<SortState | null>(initialSort);

  const sortState = sortProp !== undefined ? sortProp : innerSort;

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
        const ab = typeof av === 'boolean' ? Number(av) : Number(Boolean(av));
        const bb = typeof bv === 'boolean' ? Number(bv) : Number(Boolean(bv));
        if ((typeof av === 'boolean') || (typeof bv === 'boolean')) return ab - bb;
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

  return (
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
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: 12, textAlign: 'center', color: '#666' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row, idx) => {
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
  );
}