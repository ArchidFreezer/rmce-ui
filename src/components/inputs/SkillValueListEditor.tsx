import * as React from 'react';
import { LabeledInput } from './LabeledInput';
import { LabeledSelect } from './LabeledSelect';

import { sanitizeUnsignedInt, sanitizeSignedInt } from '../../utils/inputHelpers';

export type SkillValueRowVM = {
  id: string;
  subcategory?: string | undefined;
  value: string;
};

export interface SkillValueListEditorProps {
  title: string;
  rows: SkillValueRowVM[];
  onChangeRows: (next: SkillValueRowVM[]) => void;

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

/**
 * SkillValueListEditor component
 * 
 * Renders a list of rows, each containing a Skill selected from a dropdown and an associated value input.
 * The value input is sanitized to allow only integers, with an option for signed or unsigned values.
 * The component supports loading and viewing states, and displays error messages when provided.
 * 
 * Allows adding and removing rows, and supports loading and viewing states.
 * 
 * @param param0  Props for the SkillValueListEditor component
 * @returns JSX.Element
 */
export function SkillValueListEditor({
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
}: SkillValueListEditorProps) {
  const sanitize = signedValues ? sanitizeSignedInt : sanitizeUnsignedInt;

  const updateRowAt = React.useCallback(
    (index: number, patch: Partial<SkillValueRowVM>) => {
      const copy = rows.slice();

      if (index < 0 || index >= copy.length) return;
      const current = copy[index];
      if (!current) return;

      const nextRow: SkillValueRowVM = {
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
    const next: SkillValueRowVM[] = [
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

  const showActions = !viewing;

  return (
    <section style={{ marginTop: 12 }}>
      <h4 style={{ margin: '8px 0' }}>{title}</h4>

      {showActions && (
        <button type="button" onClick={addRow} style={{ marginBottom: 8 }}>{addButtonLabel}</button>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showActions
            ? 'minmax(280px, 1fr) 1fr 120px auto'
            : 'minmax(280px, 1fr) 1fr 120px',
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>{idColumnLabel}</div>
        <div style={{ fontWeight: 600 }}>{subcategoryColumnLabel}</div>
        <div style={{ fontWeight: 600 }}>{valueColumnLabel}</div>
        {showActions && <div />}

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

            {showActions && (
              <button type="button" onClick={() => removeRowAt(i)} style={{ color: '#b00020' }}>{removeButtonLabel}</button>
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