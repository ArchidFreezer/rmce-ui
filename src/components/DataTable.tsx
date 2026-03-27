import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  JSX,
} from 'react'


import './DataTable.css';

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

type ColumnWidthMap = Record<string, number>;

function loadWidths(persistKey?: string): ColumnWidthMap {
  if (!persistKey) return {};
  try {
    const s = localStorage.getItem(`${persistKey}:colWidths`);
    return s ? (JSON.parse(s) as ColumnWidthMap) : {};
  } catch {
    return {};
  }
}

function saveWidths(persistKey: string | undefined, widths: ColumnWidthMap) {
  if (!persistKey) return;
  try {
    localStorage.setItem(`${persistKey}:colWidths`, JSON.stringify(widths));
  } catch { }
}

function clearWidths(persistKey?: string) {
  if (!persistKey) return;
  try {
    localStorage.removeItem(`${persistKey}:colWidths`);
  } catch { }
}

export interface DataTableHandle {
  /** Clears persisted column widths and resets the current rendered widths. */
  resetColumnWidths: () => void;
  /** Adjusts the widths of all columns to fit their content */
  autoFitAllColumns: () => void;
}

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
  /** Initial width for this column (px or CSS width string) */
  width?: number | string;
  /** Minimum width (px) for resizing */
  minWidth?: number;
  /** Maximum width (px) for resizing */
  maxWidth?: number;
  /** Allow this column to be resizable (defaults to table-level `resizable`) */
  resizable?: boolean;
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
  /** Additional class for the wrapper to set theme */
  className?: string;
  /** Enable row hover effect */
  hover?: boolean;
  /** Dense row height */
  dense?: boolean;
  /** Zebra striping */
  zebra?: boolean;
  /** Optional table ARIA label */
  ariaLabel?: string;

  // **** NEW: Column resizing ****
  /** Enable resizers for header columns (default: true) */
  resizable?: boolean | undefined;
  /** Persist widths to localStorage under this key (optional) */
  persistKey?: string | undefined;
  /** Callback after a resize finishes (all current widths in px where available) */
  onColumnResizeEnd?: (widthsPx: Record<string, number | undefined>) => void;
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

export type DataTableComponent =
  <T>(
    props: DataTableProps<T> & { ref?: React.Ref<DataTableHandle | undefined> }
  ) => JSX.Element;

// Keep the same implementation, but name the inner function (better stacks)
const DataTableInner = <T,>(
  props: DataTableProps<T>,
  ref: React.Ref<DataTableHandle | undefined>
) => {

  const {
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
    initialPageSize = 20,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [5, 10, 20, 50, 100],
    showPagination = true,

    // theming/UX
    className,
    hover = true,
    zebra = false,
    dense = false,
    emptyMessage = 'No results.',
    tableMinWidth = 800,
    ariaLabel,

    // resizing
    resizable = true,
    persistKey,
    onColumnResizeEnd,
  } = props;

  // widths state keyed by column id
  const [colWidths, setColWidths] = useState<ColumnWidthMap>(() => loadWidths(persistKey));

  // Expose imperative API to parent
  useImperativeHandle(ref, (): DataTableHandle => ({
    resetColumnWidths: () => {
      clearWidths(persistKey);
      setColWidths({});
    },
    autoFitAllColumns: () => {
      const next: Record<string, number> = {};
      for (const c of columns) {
        const min = Math.max(60, c.minWidth ?? 80);
        const max = Math.max(min, c.maxWidth ?? 800);
        const natural = getMaxNaturalWidthInColumn(c.id);
        const fitted = clamp(natural, min, max);
        next[c.id] = fitted;
      }
      setColWidths(next);
      if (onColumnResizeEnd) {
        const out: Record<string, number | undefined> = {};
        for (const c of columns) out[c.id] = next[c.id];
        onColumnResizeEnd(out);
      }
    },
  }), [persistKey, columns, onColumnResizeEnd]);

  // Optional convenience: also export a static helper for non-ref usage
  (DataTable as any).resetWidthsByPersistKey = (key: string) => clearWidths(key);
  (DataTable as any).autoFitAllColumnsByPersistKey = (key: string) => {
    // This is a no-op for non-ref usage, as we need the columns context
    console.warn('autoFitAllColumnsByPersistKey is not supported without a ref');
  };

  // When user resizes a column (wherever you implement drag handles), update and save:
  const onResizeColumn = (colId: string, widthPx: number) => {
    setColWidths(prev => {
      const next = { ...prev, [colId]: widthPx };
      saveWidths(persistKey, next);
      return next;
    });
  };

  // ---------- Controlled/uncontrolled sort ----------
  const [innerSort, setInnerSort] = useState<SortState | null>(initialSort);
  const sortState = sortProp !== undefined ? sortProp : innerSort;

  // ---------- Filter ----------
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

  // ---------- Sort ----------
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
      if (typeof sortType === 'function') return (a: T, b: T) => sortType(a, b);
      if (sortType === 'number') return (a: T, b: T) => (Number(getVal(a)) || 0) - (Number(getVal(b)) || 0);
      if (sortType === 'boolean') return (a: T, b: T) => Number(Boolean(getVal(a))) - Number(Boolean(getVal(b)));
      if (sortType === 'string') {
        return (a: T, b: T) => String(getVal(a) ?? '').localeCompare(String(getVal(b) ?? ''));
      }
      return (a: T, b: T) => {
        const av = getVal(a), bv = getVal(b);
        const an = Number(av), bn = Number(bv);
        if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
        return String(av ?? '').localeCompare(String(bv ?? ''));
      };
    })();

    const arr = [...filtered];
    arr.sort((a, b) => {
      const r = cmp(a, b);
      return dir === 'asc' ? r : -r;
    });
    return arr;
  }, [filtered, sortState, columns]);

  // ---------- Pagination ----------
  const [innerPage, setInnerPage] = useState<number>(initialPage);
  const [innerPageSize, setInnerPageSize] = useState<number>(initialPageSize);
  const page = pageProp ?? innerPage;
  const pageSize = pageSizeProp ?? innerPageSize;

  const totalRows = mode === 'server' ? (totalRowsProp ?? rows.length) : sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / Math.max(1, pageSize)));

  // Clamp page whenever dependencies change
  useEffect(() => {
    const clamped = Math.min(Math.max(1, page), totalPages);
    if (clamped !== page) {
      onPageChange ? onPageChange(clamped) : setInnerPage(clamped);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages, page, onPageChange]);

  // Reset to page 1 when search query changes (common UX)
  useEffect(() => {
    if (!searchQuery) return;
    onPageChange ? onPageChange(1) : setInnerPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Compute page slice for client mode
  const pagedRows = useMemo(() => {
    if (mode === 'server') return sorted; // assume server already paginated
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return sorted.slice(start, end);
  }, [sorted, mode, page, pageSize]);

  const handleHeaderClick = (col: ColumnDef<T>, ev?: React.MouseEvent) => {
    const sortable = col.sortable ?? !!col.accessor;
    if (!sortable) return;

    // If the click originated from the resize handle, ignore sorting.
    if (ev && (ev.target as HTMLElement).closest?.('.dt__resize')) {
      return;
    }

    const next = (() => {
      if (!sortState || sortState.colId !== col.id) return { colId: col.id, dir: 'asc' as SortDir };
      return { colId: col.id, dir: sortState.dir === 'asc' ? 'desc' : 'asc' as SortDir };
    })();

    onSortChange ? onSortChange(next) : setInnerSort(next);
  };

  // ---------- Column resizing state ----------
  // type WidthMap = Record<string, number | string | undefined>;
  // const [colWidths, setColWidths] = useState<WidthMap>(() => {
  //   // Load from localStorage -> else from column.width -> else undefined
  //   if (persistKey && typeof window !== 'undefined') {
  //     try {
  //       const raw = localStorage.getItem(persistKey);
  //       if (raw) return JSON.parse(raw) as WidthMap;
  //     } catch { }
  //   }
  //   const init: WidthMap = {};
  //   for (const c of columns) {
  //     if (typeof c.width === 'number' || typeof c.width === 'string') {
  //       init[c.id] = c.width;
  //     }
  //   }
  //   return init;
  // });

  // Refs to header cells to measure when needed
  const headRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const setHeadRef = (id: string) => (el: HTMLTableCellElement | null) => {
    headRefs.current[id] = el;
  };

  // Utility: clamp a number
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  // Get a css numeric property (e.g., padding) as number
  const cssPx = (el: Element, prop: string) =>
    parseFloat(getComputedStyle(el).getPropertyValue(prop)) || 0;

  // Measure the natural width of a cell as rendered (scrollWidth already includes padding)
  const measureCell = (cell: HTMLElement) => {
    // Some cells may contain buttons / inline-blocks; scrollWidth captures full content width.
    return Math.ceil(cell.scrollWidth);
  };

  // Find column index by id
  const findColIndex = (id: string) => columns.findIndex(c => c.id === id);

  // Measure max width among header + all rendered body cells in a given column
  const getMaxNaturalWidthInColumn = (colId: string): number => {
    const th = headRefs.current[colId];
    if (!th) return 160;

    // Header width
    let max = measureCell(th);

    // Include a small buffer for sort arrow/handle gutter
    const resizeGutter = 12;
    max += resizeGutter;

    // Body cells
    const table = th.closest('table');
    if (!table) return max;

    const colIdx = findColIndex(colId);
    if (colIdx < 0) return max;

    // Look through visible rows only (pagedRows or server-provided rows),
    // which is what is actually rendered in the DOM and cheap to measure.
    // We inspect the first TBODY.
    const tb = table.tBodies?.[0];
    if (!tb) return max;

    // Iterate rows and measure the target column cell
    for (const row of Array.from(tb.rows)) {
      const cell = row.cells[colIdx] as HTMLTableCellElement | undefined;
      if (!cell) continue;
      const w = measureCell(cell);
      if (w > max) max = w;
    }

    // Add a small safety buffer to reduce re-wrap flicker
    const safety = 8;
    return max + safety;
  };

  // Double-click handler: auto-fit column to content
  const onResizeDoubleClick = (col: ColumnDef<T>, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Respect per-column/table resizable flags
    if (!(col.resizable ?? resizable)) return;

    // Determine constraints
    const min = Math.max(60, col.minWidth ?? 80);
    const max = Math.max(min, col.maxWidth ?? 800);

    // Measure content width
    const natural = getMaxNaturalWidthInColumn(col.id);
    const fitted = clamp(natural, min, max);

    // Apply width (store as px number)
    setColWidths(prev => ({ ...prev, [col.id]: fitted }));

    // Optional callback
    if (onColumnResizeEnd) {
      const out: Record<string, number | undefined> = {};
      for (const c of columns) {
        const w = c.id === col.id ? fitted : prevWidthNumber(colWidths[c.id]);
        out[c.id] = w;
      }
      onColumnResizeEnd(out);
    }
  };

  // Helper: normalize current column width to a px number if available
  const prevWidthNumber = (w: number | string | undefined): number | undefined =>
    typeof w === 'number' ? w : undefined;

  const resizingRef = useRef<{
    id: string;
    startX: number;
    startWidth: number; // px
    min: number;
    max: number;
  } | null>(null);

  // Persist widths on change
  useEffect(() => {
    if (!persistKey || typeof window === 'undefined') return;
    saveWidths(persistKey, colWidths);  // writes to `${persistKey}:colWidths`
  }, [persistKey, colWidths]);

  // Pointer handlers
  const onResizePointerDown = (col: ColumnDef<T>, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!(col.resizable ?? resizable)) return;

    const th = headRefs.current[col.id];
    const rect = th?.getBoundingClientRect();
    const startWidth = rect?.width ?? (typeof colWidths[col.id] === 'number' ? (colWidths[col.id] as number) : 0);

    // Fallback: if width 0, set to 160 as a safe starting point
    const sw = startWidth > 0 ? startWidth : 160;

    const min = Math.max(60, col.minWidth ?? 80);
    const max = Math.max(min, col.maxWidth ?? 800);

    resizingRef.current = {
      id: col.id,
      startX: e.clientX,
      startWidth: sw,
      min,
      max,
    };

    (e.target as Element).setPointerCapture?.(e.pointerId);

    // During drag, disable text selection & show col-resize cursor
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
  };

  const onPointerMove = (e: PointerEvent) => {
    const ctx = resizingRef.current;
    if (!ctx) return;

    const dx = e.clientX - ctx.startX;
    let next = Math.round(ctx.startWidth + dx);
    if (next < ctx.min) next = ctx.min;
    if (next > ctx.max) next = ctx.max;

    setColWidths((prev) => ({
      ...prev,
      [ctx.id]: next, // store px as number
    }));
  };

  const onPointerUp = () => {
    const ctx = resizingRef.current;
    resizingRef.current = null;

    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    window.removeEventListener('pointermove', onPointerMove as any);
    window.removeEventListener('pointerup', onPointerUp as any);

    if (!ctx) return;

    if (onColumnResizeEnd) {
      // Convert only numeric widths (px) to report; strings stay undefined here
      const out: Record<string, number | undefined> = {};
      for (const c of columns) {
        const w = colWidths[c.id];
        out[c.id] = typeof w === 'number' ? w : undefined;
      }
      onColumnResizeEnd(out);
    }
  };

  // Compute the width style for <col> element
  const colWidthStyle = (w: number | string | undefined): string | undefined => {
    if (w === undefined) return undefined;
    if (typeof w === 'number') return `${w}px`;
    return w; // allow '20%', '12rem', etc.
  };

  // For header alignment class
  const alignClass = (a?: 'left' | 'center' | 'right') => `dt__cell--${a ?? 'left'}`;

  // Pagination ranges
  const fromRow = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRow = totalRows === 0 ? 0 : Math.min(page * pageSize, totalRows);

  return (
    <>
      <div className={`dt__wrap ${className ?? ''}`.trim()}>
        <table
          className={[
            'dt',
            dense ? 'dt--dense' : '',
            hover ? 'dt--hover' : '',
            zebra ? 'dt--zebra' : '',
            resizable ? 'dt--resizable' : '',
          ].join(' ').trim()}
          style={{
            borderCollapse: 'collapse',
            minWidth: tableMinWidth,
            width: '100%',
            tableLayout: 'fixed', // helps keep widths stable during drag
          }}
          aria-label={ariaLabel}
        >
          {/* **** NEW: colgroup that applies widths per column **** */}
          <colgroup>
            {columns.map((c) => (
              <col key={c.id} style={{ width: colWidthStyle(colWidths[c.id]) }} />
            ))}
          </colgroup>

          <thead className="dt__head">
            <tr className="dt__row dt__row--head">
              {columns.map((c) => {
                const sortable = c.sortable ?? !!c.accessor;
                const active = sortState?.colId === c.id;
                const arrow = active ? (sortState?.dir === 'asc' ? ' ▲' : ' ▼') : '';
                const colIsResizable = (c.resizable ?? resizable) && columns.length > 1; // don't resize if single col
                return (
                  <th
                    key={c.id}
                    ref={setHeadRef(c.id)}
                    className={[
                      'dt__cell',
                      'dt__cell--head',
                      sortable ? 'dt__cell--sortable' : '',
                      active ? 'dt__cell--sorted' : '',
                      alignClass(c.align),
                    ].join(' ').trim()}
                    title={c.headerTitle ?? (typeof c.header === 'string' ? c.header : undefined)}
                    onClick={(ev) => handleHeaderClick(c, ev)}
                    scope="col"
                  >
                    <div className="dt__head-inner">
                      <span className="dt__head-label">{c.header}{sortable ? arrow : null}</span>

                      {/* **** NEW: Resize handle **** */}
                      {colIsResizable && (
                        <span
                          className="dt__resize"
                          onPointerDown={(e) => onResizePointerDown(c, e)}
                          onDoubleClick={(e) => onResizeDoubleClick(c, e)}
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={
                            typeof c.header === 'string'
                              ? `Resize column ${c.header}`
                              : `Resize column`
                          }
                        />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="dt__body">
            {(mode === 'client' ? pagedRows : sorted).length === 0 ? (
              <tr className="dt__row dt__row--empty">
                <td className="dt__cell dt__cell--empty" colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              (mode === 'client' ? pagedRows : sorted).map((row, idx) => {
                const key = rowId(row, idx);
                return (
                  <tr key={key} className="dt__row dt__row--body">
                    {columns.map((c) => {
                      const content = c.render ? c.render(row, idx) : String(c.accessor ? c.accessor(row) ?? '' : '');
                      return (
                        <td className={['dt__cell', 'dt__cell--body', alignClass(c.align)].join(' ')} key={c.id} style={{ verticalAlign: 'top' }}>
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
        <div className="dt__pagination">
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalRows={totalRows}
            totalPages={totalPages}
            pageSizeOptions={pageSizeOptions}
            onPageChange={(p) => (onPageChange ? onPageChange(p) : setInnerPage(p))}
            onPageSizeChange={(ps) => {
              onPageSizeChange ? onPageSizeChange(ps) : setInnerPageSize(ps);
              onPageChange ? onPageChange(1) : setInnerPage(1);
            }}
            fromRow={fromRow}
            toRow={toRow}
          />
        </div>
      )}
    </>
  );
};

export const DataTable = forwardRef(DataTableInner) as DataTableComponent

/** Pagination control (unchanged) */
export function DataTablePagination({
  page, pageSize, totalRows, totalPages, onPageChange, onPageSizeChange, pageSizeOptions = [5, 10, 20, 50, 100], fromRow, toRow,
}: {
  page: number; pageSize: number; totalRows: number; totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  fromRow: number; toRow: number;
}) {
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <div role="navigation" aria-label="Table pagination"
      style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ fontSize: 14 }}>
          Rows per page:{' '}
          <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} style={{ padding: '4px 8px' }} aria-label="Rows per page">
            {pageSizeOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
          </select>
        </label>
      </div>
      <div style={{ fontSize: 14, color: 'var(--text)' }}>
        {totalRows === 0 ? '0–0 of 0' : `${fromRow}–${toRow} of ${totalRows}`}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => onPageChange(1)} disabled={!canPrev} aria-label="First page" style={{ padding: '4px 8px' }}>« First</button>
        <button onClick={() => onPageChange(page - 1)} disabled={!canPrev} aria-label="Previous page" style={{ padding: '4px 8px' }}>‹ Prev</button>
        <span style={{ minWidth: 90, textAlign: 'center', fontSize: 14 }}>Page {Math.min(page, totalPages)} of {totalPages}</span>
        <button onClick={() => onPageChange(page + 1)} disabled={!canNext} aria-label="Next page" style={{ padding: '4px 8px' }}>Next ›</button>
        <button onClick={() => onPageChange(totalPages)} disabled={!canNext} aria-label="Last page" style={{ padding: '4px 8px' }}>Last »</button>
      </div>
    </div>
  );
}