import * as React from 'react';
import { LabeledSelect } from './LabeledSelect';

export type IdListRowVM<TId extends string = string> = TId | '';

export interface IdListEditorProps<TId extends string = string> {
  title: string;
  rows: IdListRowVM<TId>[];
  onChangeRows: (next: IdListRowVM<TId>[]) => void;

  /** Options for the selector */
  options: Array<{ value: TId; label: string }>;

  loading?: boolean | undefined;
  viewing?: boolean | undefined;
  error?: string | undefined;

  /** Optional labels */
  columnLabel?: string | undefined;

  /** Optional button labels */
  addButtonLabel?: string | undefined;
  removeButtonLabel?: string | undefined;

  /** Optional width/layout override */
  columnMinWidth?: number | string | undefined;
}

export function IdListEditor<TId extends string = string>({
  title,
  rows,
  onChangeRows,
  options,
  loading,
  viewing,
  error,
  columnLabel = 'Value',
  addButtonLabel = '+ Add row',
  removeButtonLabel = 'Remove',
  columnMinWidth = 280,
}: IdListEditorProps<TId>) {
  const showActions = !viewing;

  const resolvedColumnWidth =
    typeof columnMinWidth === 'number'
      ? `${columnMinWidth}px`
      : columnMinWidth;

  const updateRowAt = React.useCallback(
    (index: number, nextValue: TId | '') => {
      const copy = rows.slice();

      if (index < 0 || index >= copy.length) return;
      if (copy[index] === undefined) return;

      copy[index] = nextValue;
      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  const addRow = React.useCallback(() => {
    const next: IdListRowVM<TId>[] = [...rows, ''];
    onChangeRows(next);
  }, [rows, onChangeRows]);

  const removeRowAt = React.useCallback(
    (index: number) => {
      const copy = rows.slice();

      if (index < 0 || index >= copy.length) return;
      copy.splice(index, 1);

      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  return (
    <section style={{ marginTop: 12 }}>
      <h4 style={{ margin: '8px 0' }}>{title}</h4>

      {!viewing && (
        <button
          type="button"
          onClick={addRow}
          style={{ marginBottom: 8 }}
        >
          {addButtonLabel}
        </button>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showActions
            ? `minmax(${resolvedColumnWidth}, 1fr) auto`
            : `minmax(${resolvedColumnWidth}, 1fr)`,
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>{columnLabel}</div>
        {showActions && <div />}

        {rows.map((row, i) => (
          <React.Fragment key={`${title}-${i}`}>
            <LabeledSelect
              label={columnLabel}
              hideLabel
              ariaLabel={columnLabel}
              value={row}
              onChange={(v) => updateRowAt(i, v as TId)}
              options={options}
              disabled={loading || viewing}
            />

            {showActions && (
              <button
                type="button"
                onClick={() => removeRowAt(i)}
                style={{ color: '#b00020' }}
              >
                {removeButtonLabel}
              </button>
            )}
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div style={{ color: '#b00020', marginTop: 6 }}>
          {error}
        </div>
      )}
    </section>
  );
}