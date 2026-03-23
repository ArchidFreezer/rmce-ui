import * as React from 'react';
import { LabeledInput } from './LabeledInput';
import { LabeledSelect } from './LabeledSelect';

import { sanitizeUnsignedInt, sanitizeSignedInt } from '../../utils/inputHelpers';

export type IdValueRowVM<TId extends string = string> = {
  id: TId | '';
  value: string;
};

export interface IdValueListEditorProps<TId extends string = string> {
  title: string;
  rows: IdValueRowVM<TId>[];
  onChangeRows: (next: IdValueRowVM<TId>[]) => void;

  options: Array<{ value: TId; label: string }>;

  loading?: boolean | undefined;
  viewing?: boolean | undefined;
  /** Whether to show the component when viewing if there are no rows */
  showWhenEmpty?: boolean | undefined;

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

/**
 * IdValueListEditor component
 * 
 * Renders a list of rows, each containing an ID selected from a dropdown and an associated value input.
 * The value input is sanitized to allow only integers, with an option for signed or unsigned values.
 * The component supports loading and viewing states, and displays error messages when provided.
 * 
 * Allows adding and removing rows, and supports loading and viewing states.
 * 
 * @param param0 Props for the IdValueListEditor component
 * @returns JSX.Element
 */
export function IdValueListEditor<TId extends string = string>({
  title,
  rows,
  onChangeRows,
  options,
  loading,
  viewing,
  showWhenEmpty = false,
  error,
  idColumnLabel = 'ID',
  valueColumnLabel = 'Value',
  addButtonLabel = '+ Add row',
  removeButtonLabel = 'Remove',
  signedValues = true,
  valueWidth = 100,
}: IdValueListEditorProps<TId>) {
  const sanitize = signedValues ? sanitizeSignedInt : sanitizeUnsignedInt;

  const updateRowAt = React.useCallback(
    (index: number, patch: Partial<IdValueRowVM<TId>>) => {
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
    const next: IdValueRowVM<TId>[] = [...rows, { id: '', value: '' }];
    onChangeRows(next);
  }, [rows, onChangeRows]);

  const showActions = !viewing;

  const showComponent = viewing ? rows.length > 0 || showWhenEmpty : true;
  if (!showComponent) return null;

  return (
    <section style={{ marginTop: 12 }}>
      <h4 style={{ margin: '8px 0' }}>{title}</h4>

      {showActions && (
        <button type="button" onClick={addRow} style={{ marginBottom: 8 }}>
          {addButtonLabel}
        </button>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showActions ? 'minmax(280px, 1fr) 120px auto' : 'minmax(280px, 1fr) 120px',
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>{idColumnLabel}</div>
        <div style={{ fontWeight: 600 }}>{valueColumnLabel}</div>
        {showActions && <div />}

        {rows.map((row, i) => (
          <React.Fragment key={`${title}-${i}`}>
            <LabeledSelect
              label={idColumnLabel}
              hideLabel
              ariaLabel={idColumnLabel}
              value={row.id}
              onChange={(v) => updateRowAt(i, { id: v as TId })}
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

            {showActions && (
              <button type="button" onClick={() => removeRowAt(i)} style={{ color: '#b00020' }}>
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
