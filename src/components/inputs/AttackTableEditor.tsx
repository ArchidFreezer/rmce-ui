import * as React from 'react';
import { LabeledInput } from './LabeledInput';

export type AttackTableRowVM = {
  min: string;
  max: string;
  /** Exactly 20 cells (at1..at20). Keep strings to allow tokens like "6|Krush:A". */
  cells: string[];
};

type Props = {
  sectionKey: 'modified' | 'unmodified' | string;
  title: string;
  rows: AttackTableRowVM[];
  onChangeRows: (next: AttackTableRowVM[]) => void;
  viewing?: boolean | undefined;
  error?: string | undefined;

  /** Optional: number of AT columns; defaults to 20 */
  atColumns?: number | undefined;

  /** Width for min/max inputs; defaults to 72px */
  minMaxWidth?: number | string | undefined;

  /** Width for each at* input cell; undefined = use default input width */
  atCellWidth?: number | string | undefined;

  /** Show “Add row” even when viewing (rare). Defaults false. */
  allowAddInView?: boolean | undefined;
};

export function AttackTableEditor({
  sectionKey,
  title,
  rows,
  onChangeRows,
  viewing,
  error,
  atColumns = 20,
  minMaxWidth = 72,
  atCellWidth,
  allowAddInView = false,
}: Props) {
  const totalCols = 2 + atColumns + 1; // min, max, at*, actions

  const gridStyle: React.CSSProperties = React.useMemo(() => {
    const atWidths = Array.from({ length: atColumns }, () => '70px').join(' ');
    return {
      display: 'grid',
      gridTemplateColumns: `90px 90px ${atWidths} 100px`,
      gap: 6,
      alignItems: 'center',
    };
  }, [atColumns]);

  const focusCell = (r: number, c: number) => {
    const id = `${sectionKey}-${r}-${c}`;
    const el = document.getElementById(id) as HTMLInputElement | null;
    el?.focus();
    el?.select?.();
  };

  const handleNav = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (viewing) return;
    const r = Number(e.currentTarget.dataset.row);
    const c = Number(e.currentTarget.dataset.col);
    if (Number.isNaN(r) || Number.isNaN(c)) return;

    const atStart = e.currentTarget.selectionStart === 0;
    const atEnd = e.currentTarget.selectionStart === e.currentTarget.value.length;

    switch (e.key) {
      case 'ArrowLeft':
        if (!atStart) return;
        e.preventDefault();
        if (c > 0) focusCell(r, c - 1);
        break;
      case 'ArrowRight':
        if (!atEnd) return;
        e.preventDefault();
        if (c < totalCols - 1) focusCell(r, c + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (r > 0) focusCell(r - 1, c);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (r < rows.length - 1) focusCell(r + 1, c);
        break;
      case 'Enter':
        e.preventDefault();
        if (e.shiftKey) {
          if (r > 0) focusCell(r - 1, c);
        } else {
          if (r < rows.length - 1) focusCell(r + 1, c);
        }
        break;
    }
  };

  const parsePasted = (text: string): string[] => {
    if (!text) return [];
    if (text.includes('\t')) return text.split('\t').map((s) => s.trim());
    if (text.includes(',')) return text.split(',').map((s) => s.trim());
    return text.trim().split(/\s+/);
  };

  // full-row update helpers to avoid type widening
  const updateRowField = (row: AttackTableRowVM, key: 'min' | 'max', val: string): AttackTableRowVM => {
    return { min: key === 'min' ? val : row.min, max: key === 'max' ? val : row.max, cells: row.cells.slice() };
  };
  const updateRowCell = (row: AttackTableRowVM, index: number, val: string): AttackTableRowVM => {
    const cells = row.cells.slice();
    if (index >= 0 && index < atColumns) {
      cells[index] = val;
    }
    return { min: row.min, max: row.max, cells };
  };

  const onPasteCells = (
    rowIdx: number,
    startCol: number,
    e: React.ClipboardEvent<HTMLInputElement>
  ) => {
    if (viewing) return;
    e.preventDefault();

    const values = parsePasted(e.clipboardData.getData('text'));
    if (!values.length) return;

    // 1) Bounds check + narrow
    if (rowIdx < 0 || rowIdx >= rows.length) return;

    const isInt = (s: string | undefined) => !!s && /^\d+$/.test(s);

    // 2) Clone array & take a non-null row reference
    const next = rows.slice();
    const row0 = next[rowIdx];
    if (!row0) return;

    // Work on a non-optional RowVM copy
    let curr: AttackTableRowVM = { min: row0.min, max: row0.max, cells: row0.cells.slice() };

    // Fill cells & return full row
    const fillCellsFrom = (row: AttackTableRowVM, src: string[], startAt: number): AttackTableRowVM => {
      const cells = row.cells.slice();
      const limit = Math.min(atColumns, src.length);
      for (let i = 0; i < limit; i++) {
        const idx = startAt + i;
        if (idx >= atColumns) break;
        const v = src[i] ?? '-';
        cells[idx] = v === '' ? '-' : v;
      }
      return { min: row.min, max: row.max, cells };
    };

    if (startCol === 0) {
      const [minMaybe, maxMaybe, ...rest] = values;
      const min = isInt(minMaybe) ? minMaybe! : curr.min;
      const max = isInt(maxMaybe) ? maxMaybe! : curr.max;
      const base = isInt(minMaybe) && isInt(maxMaybe) ? rest : values;
      curr = { min, max, cells: curr.cells.slice() };
      curr = fillCellsFrom(curr, base, 0);
    } else if (startCol === 1) {
      const [maxMaybe, ...rest] = values;
      const max = isInt(maxMaybe) ? maxMaybe! : curr.max;
      const base = isInt(maxMaybe) && rest.length ? rest : values;
      curr = { min: curr.min, max, cells: curr.cells.slice() };
      curr = fillCellsFrom(curr, base, 0);
    } else {
      const cellIdx = Math.max(0, startCol - 2);
      curr = fillCellsFrom(curr, values, cellIdx);
    }

    next[rowIdx] = curr;
    onChangeRows(next);
  };

  const header = (
    <div style={gridStyle}>
      <div style={{ fontWeight: 600 }}>Min</div>
      <div style={{ fontWeight: 600 }}>Max</div>
      {Array.from({ length: atColumns }, (_, i) => (
        <div key={`h-${i}`} style={{ fontWeight: 600 }}>{`AT ${i + 1}`}</div>
      ))}
      <div style={{ fontWeight: 600 }}>Actions</div>
    </div>
  );

  const canAdd = !viewing || allowAddInView;

  return (
    <section style={{ marginTop: 8 }}>
      <h4 style={{ margin: '8px 0' }}>{title}</h4>

      {canAdd && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => onChangeRows([...rows, { min: '', max: '', cells: Array(atColumns).fill('-') }])}
          >
            + Add row
          </button>
          {error && <span style={{ color: '#b00020' }}>{error}</span>}
        </div>
      )}
      {!canAdd && error && <div style={{ color: '#b00020' }}>{error}</div>}

      {header}

      <div role="grid" aria-label={`${title} grid`} style={{ display: 'grid', gap: 6 }}>
        {rows.map((r, rowIdx) => (
          <div key={`${sectionKey}-row-${rowIdx}`} style={gridStyle}>
            {/* Min */}
            <LabeledInput
              label="Min"
              hideLabel
              ariaLabel="Min"
              value={r.min}
              onChange={(val) => {
                if (viewing) return;
                const digits = val.replace(/[^\d]/g, '');
                const next = rows.slice();
                if (rowIdx < 0 || rowIdx >= next.length) return;
                const row = next[rowIdx]; if (!row) return;
                next[rowIdx] = updateRowField(row, 'min', digits);
                onChangeRows(next);
              }}
              disabled={viewing}
              width={minMaxWidth}
              inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
            />

            {/* Max */}
            <LabeledInput
              label="Max"
              hideLabel
              ariaLabel="Max"
              value={r.max}
              onChange={(val) => {
                if (viewing) return;
                const digits = val.replace(/[^\d]/g, '');
                const next = rows.slice();
                if (rowIdx < 0 || rowIdx >= next.length) return;
                const row = next[rowIdx]; if (!row) return;
                next[rowIdx] = updateRowField(row, 'max', digits);
                onChangeRows(next);
              }}
              disabled={viewing}
              width={minMaxWidth}
              inputProps={{ inputMode: 'numeric', pattern: '^\\d+$' }}
            />

            {/* AT1..ATN */}
            {r.cells.map((cell, i) => (
              <input
                key={`${sectionKey}-${rowIdx}-c-${i}`}
                id={`${sectionKey}-${rowIdx}-${i + 2}`}
                data-row={rowIdx}
                data-col={i + 2}
                value={cell}
                onChange={(e) => {
                  if (viewing) return;
                  const val = e.target.value;
                  const next = rows.slice();
                  if (rowIdx < 0 || rowIdx >= next.length) return;
                  const row = next[rowIdx]; if (!row) return;
                  next[rowIdx] = updateRowCell(row, i, val === '' ? '' : val);
                  onChangeRows(next);
                }}
                onKeyDown={handleNav}
                onPaste={(e) => onPasteCells(rowIdx, i + 2, e)}
                disabled={viewing}
                style={{
                  padding: 6,
                  ...(atCellWidth
                    ? { width: typeof atCellWidth === 'number' ? `${atCellWidth}px` : atCellWidth }
                    : {}),
                }}
                aria-label={`Row ${rowIdx + 1} AT${i + 1}`}
              />
            ))}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6 }}>
              {!viewing && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const clone: AttackTableRowVM = { min: r.min, max: r.max, cells: r.cells.slice() };
                      const next = rows.slice();
                      next.splice(rowIdx + 1, 0, clone);
                      onChangeRows(next);
                    }}
                    title="Duplicate row"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = rows.slice();
                      next.splice(rowIdx, 1);
                      onChangeRows(next);
                    }}
                    title="Remove row"
                    style={{ color: '#b00020' }}
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}