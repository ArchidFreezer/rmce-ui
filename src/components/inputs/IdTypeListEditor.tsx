import * as React from 'react';
import { LabeledSelect } from './LabeledSelect';

export type IdTypeRowVM<TType extends string = string> = {
  id: string;
  value: TType | '';
};

export interface IdTypeListEditorProps<TType extends string = string> {
  title: string;
  rows: IdTypeRowVM<TType>[];
  onChangeRows: (next: IdTypeRowVM<TType>[]) => void;

  /** Options for the ID column */
  idOptions: Array<{ value: string; label: string }>;

  /** Options for the Type column */
  typeOptions: Array<{ value: TType; label: string }>;

  loading?: boolean | undefined;
  viewing?: boolean | undefined;
  error?: string | undefined;

  /** Optional labels */
  idColumnLabel?: string | undefined;
  typeColumnLabel?: string | undefined;

  /** Optional button labels */
  addButtonLabel?: string | undefined;
  removeButtonLabel?: string | undefined;

  /** Optional width overrides */
  idColumnMinWidth?: number | string | undefined;
  typeColumnWidth?: number | string | undefined;
}

export function IdTypeListEditor<TType extends string = string>({
  title,
  rows,
  onChangeRows,
  idOptions,
  typeOptions,
  loading,
  viewing,
  error,
  idColumnLabel = 'ID',
  typeColumnLabel = 'Type',
  addButtonLabel = '+ Add row',
  removeButtonLabel = 'Remove',
  idColumnMinWidth = 280,
  typeColumnWidth = 220,
}: IdTypeListEditorProps<TType>) {
  const resolvedIdColumnWidth =
    typeof idColumnMinWidth === 'number' ? `${idColumnMinWidth}px` : idColumnMinWidth;

  const resolvedTypeColumnWidth =
    typeof typeColumnWidth === 'number' ? `${typeColumnWidth}px` : typeColumnWidth;

  const updateRowAt = React.useCallback(
    (index: number, patch: Partial<IdTypeRowVM<TType>>) => {
      const copy = rows.slice();

      if (index < 0 || index >= copy.length) return;
      const current = copy[index];
      if (!current) return;

      copy[index] = {
        id: patch.id ?? current.id,
        value: patch.value ?? current.value,
      };

      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  const removeRowAt = React.useCallback(
    (index: number) => {
      const copy = rows.slice();

      if (index < 0 || index >= copy.length) return;
      copy.splice(index, 1);

      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  const addRow = React.useCallback(() => {
    const next: IdTypeRowVM<TType>[] = [...rows, { id: '', value: '' }];
    onChangeRows(next);
  }, [rows, onChangeRows]);

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
          gridTemplateColumns: `minmax(${resolvedIdColumnWidth}, 1fr) ${resolvedTypeColumnWidth} auto`,
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>{idColumnLabel}</div>
        <div style={{ fontWeight: 600 }}>{typeColumnLabel}</div>
        <div />

        {rows.map((row, i) => (
          <React.Fragment key={`${title}-${i}`}>
            <LabeledSelect
              label={idColumnLabel}
              hideLabel
              ariaLabel={idColumnLabel}
              value={row.id}
              onChange={(v) => updateRowAt(i, { id: v })}
              options={idOptions}
              disabled={loading || viewing}
            />

            <LabeledSelect
              label={typeColumnLabel}
              hideLabel
              ariaLabel={typeColumnLabel}
              value={row.value}
              onChange={(v) => updateRowAt(i, { value: v as TType })}
              options={typeOptions}
              disabled={loading || viewing}
            />

            {!viewing && (
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