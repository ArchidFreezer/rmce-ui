import * as React from 'react';
import { LabeledInput } from './LabeledInput';
import { LabeledSelect } from './LabeledSelect';

import { sanitizeUnsignedInt, sanitizeSignedInt } from '../../utils/inputHelpers';

export type IdValueRowVM = {
  id: string;
  value: string;
};

export interface IdValueListEditorProps {
  title: string;
  rows: IdValueRowVM[];
  onChangeRows: (next: IdValueRowVM[]) => void;

  options: Array<{ value: string; label: string }>;
  loading?: boolean | undefined;
  viewing?: boolean | undefined;
  error?: string | undefined;

  /** Column header labels */
  idColumnLabel?: string | undefined;
  valueColumnLabel?: string | undefined;

  /** Button labels */
  addButtonLabel?: string | undefined;
  removeButtonLabel?: string | undefined;

  /** Use signed integers? default true */
  signedValues?: boolean | undefined;

  /** Width of value input */
  valueWidth?: number | string | undefined;
}

export function IdValueListEditor({
  title,
  rows,
  onChangeRows,
  options,
  loading,
  viewing,
  error,
  idColumnLabel = 'ID',
  valueColumnLabel = 'Value',
  addButtonLabel = '+ Add row',
  removeButtonLabel = 'Remove',
  signedValues = true,
  valueWidth = 100,
}: IdValueListEditorProps) {
  const sanitize = signedValues ? sanitizeSignedInt : sanitizeUnsignedInt;

  const updateRowAt = React.useCallback(
    (index: number, patch: Partial<IdValueRowVM>) => {
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
    onChangeRows([...rows, { id: '', value: '' }]);
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
          gridTemplateColumns: 'minmax(280px, 1fr) 120px auto',
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>{idColumnLabel}</div>
        <div style={{ fontWeight: 600 }}>{valueColumnLabel}</div>
        <div />

        {rows.map((row, i) => (
          <React.Fragment key={`${title}-${i}`}>
            <LabeledSelect
              label={idColumnLabel}
              hideLabel
              ariaLabel={idColumnLabel}
              value={row.id}
              onChange={(v) => updateRowAt(i, { id: v })}
              options={options}
              disabled={loading || viewing}
            />

            <LabeledInput
              label={valueColumnLabel}
              hideLabel
              ariaLabel={valueColumnLabel}
              value={row.value}
              onChange={(v) => updateRowAt(i, { value: sanitize(v) })}
              disabled={viewing}
              width={valueWidth}
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