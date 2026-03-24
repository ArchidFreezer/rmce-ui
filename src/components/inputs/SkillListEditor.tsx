import * as React from 'react';
import { LabeledInput } from './LabeledInput';
import { LabeledSelect } from './LabeledSelect';

export type SkillRowVM = {
  id: string;
  subcategory?: string | undefined;
};

export interface SkillListEditorProps {

  title: string;
  rows: SkillRowVM[];
  onChangeRows: (next: SkillRowVM[]) => void;

  /** Options for the ID selector */
  idOptions: Array<{ value: string; label: string }>;

  loading?: boolean | undefined;
  viewing?: boolean | undefined;
  /** Whether to show the component when viewing if there are no rows */
  showWhenEmpty?: boolean | undefined;

  error?: string | undefined;

  /** Optional labels */
  idColumnLabel?: string | undefined;
  subcategoryColumnLabel?: string | undefined;

  /** Optional button labels */
  addButtonLabel?: string | undefined;
  removeButtonLabel?: string | undefined;

  /** Optional width/layout overrides */
  idColumnMinWidth?: number | string | undefined;
}

/**
 * SkillListEditor component
 * 
 * Renders a list of rows, each containing a Skill selected from a dropdown and an optional subcategory input.
 * The component supports loading and viewing states, and displays error messages when provided.
 * 
 * Allows adding and removing rows, and supports loading and viewing states.
 * @param param0  Props for the SkillListEditor component
 * @returns JSX.Element
 */
export function SkillListEditor({
  title,
  rows,
  onChangeRows,
  idOptions,
  loading,
  viewing,
  showWhenEmpty = false,
  error,
  idColumnLabel = 'ID',
  subcategoryColumnLabel = 'Subcategory',
  addButtonLabel = '+ Add row',
  removeButtonLabel = 'Remove',
  idColumnMinWidth = 280,
}: SkillListEditorProps) {
  const showActions = !viewing;

  const resolvedIdColumnWidth =
    typeof idColumnMinWidth === 'number'
      ? `${idColumnMinWidth}px`
      : idColumnMinWidth;

  const updateRowAt = React.useCallback(
    (index: number, patch: Partial<SkillRowVM>) => {
      const copy = rows.slice();

      if (index < 0 || index >= copy.length) return;
      const current = copy[index];
      if (!current) return;

      const nextRow: SkillRowVM = {
        id: patch.id ?? current.id,
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
    const next: SkillRowVM[] = [
      ...rows,
      {
        id: '',
        subcategory: '',
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

  const showComponent = viewing ? rows.length > 0 || showWhenEmpty : true;
  if (!showComponent) return null;

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
            ? `minmax(${resolvedIdColumnWidth}, 1fr) 1fr auto`
            : `minmax(${resolvedIdColumnWidth}, 1fr) 1fr`,
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>{idColumnLabel}</div>
        <div style={{ fontWeight: 600 }}>{subcategoryColumnLabel}</div>
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
