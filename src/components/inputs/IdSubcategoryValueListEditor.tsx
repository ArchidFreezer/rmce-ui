import * as React from 'react';
import { LabeledInput } from './LabeledInput';
import { LabeledSelect } from './LabeledSelect';

import { sanitizeUnsignedInt, sanitizeSignedInt } from '../../utils/inputHelpers';

export type IdSubcategoryValueRowVM = {
  id: string;
  subcategory?: string | undefined;
  value: string;
};

export interface IdSubcategoryValueListEditorProps {
  title: string;
  rows: IdSubcategoryValueRowVM[];
  onChangeRows: (next: IdSubcategoryValueRowVM[]) => void;

  /** Options for the ID column */
  idOptions: Array<{ value: string; label: string }>;

  loading?: boolean | undefined;
  viewing?: boolean | undefined;
  error?: string | undefined;

  /** Optional labels */
  idColumnLabel?: string | undefined;
  subcategoryColumnLabel?: string | undefined;
  valueColumnLabel?: string | undefined;

  /** Optional button labels */
  addButtonLabel?: string | undefined;
  removeButtonLabel?: string | undefined;

  /** Whether the numeric value should allow a leading minus sign. Default: true */
  signedValues?: boolean | undefined;

  /** Optional width for the numeric input */
  valueWidth?: number | string | undefined;
}

export function IdSubcategoryValueListEditor({
  title,
  rows,
  onChangeRows,
  idOptions,
  loading,
  viewing,
  error,
  idColumnLabel = 'ID',
  subcategoryColumnLabel = 'Subcategory',
  valueColumnLabel = 'Value',
  addButtonLabel = '+ Add row',
  removeButtonLabel = 'Remove',
  signedValues = true,
  valueWidth = 100,
}: IdSubcategoryValueListEditorProps) {
  const sanitize = signedValues ? sanitizeSignedInt : sanitizeUnsignedInt;

  const updateRowAt = React.useCallback(
    (index: number, patch: Partial<IdSubcategoryValueRowVM>) => {
      const copy = rows.slice();

      if (index < 0 || index >= copy.length) return;
      const current = copy[index];
      if (!current) return;

      const nextRow: IdSubcategoryValueRowVM = {
        id: patch.id ?? current.id,
        value: patch.value ?? current.value,
        subcategory: Object.prototype.hasOwnProperty.call(patch, 'subcategory')
          ? patch.subcategory
          : current.subcategory,
      };

      copy[index] = nextRow;
      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  const addRow = React.useCallback(() => {
    const next: IdSubcategoryValueRowVM[] = [
      ...rows,
      {
        id: '',
        subcategory: '',
        value: '',
      },
    ];
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
          gridTemplateColumns: 'minmax(280px, 1fr) 1fr 120px auto',
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>{idColumnLabel}</div>
        <div style={{ fontWeight: 600 }}>{subcategoryColumnLabel}</div>
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
              options={idOptions}
              disabled={loading || viewing}
            />

            <LabeledInput
              label={subcategoryColumnLabel}
              hideLabel
              ariaLabel={subcategoryColumnLabel}
              value={row.subcategory ?? ''}
              onChange={(v) => updateRowAt(i, { subcategory: v })}
              disabled={viewing}
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