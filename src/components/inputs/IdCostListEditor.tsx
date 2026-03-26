import * as React from 'react';
import { LabeledInput } from './LabeledInput';
import { LabeledSelect } from './LabeledSelect';

export type IdCostRowVM = {
  category: string;
  cost: string;
};

export interface IdCostListEditorProps {
  title: string;
  rows: IdCostRowVM[];
  onChangeRows: (next: IdCostRowVM[]) => void;

  /** Options for the category selector */
  categoryOptions: Array<{ value: string; label: string }>;

  loading?: boolean | undefined;
  viewing?: boolean | undefined;
  /** Whether to show the component when viewing if there are no rows */
  showWhenEmpty?: boolean | undefined;

  error?: string | undefined;

  /** Optional labels */
  categoryColumnLabel?: string | undefined;
  costColumnLabel?: string | undefined;

  /** Optional button labels */
  addButtonLabel?: string | undefined;
  removeButtonLabel?: string | undefined;

  /** Optional width for the cost input */
  costWidth?: number | string | undefined;
}

const sanitizeCost = (s: string): string => s.replace(/^[1-9]\d*(?::[1-9]\d*){0,2}$/g, '');

export function IdCostListEditor({
  title,
  rows,
  onChangeRows,
  categoryOptions,
  loading,
  viewing,
  showWhenEmpty = false,
  error,
  categoryColumnLabel = 'Category',
  costColumnLabel = 'Cost',
  addButtonLabel = '+ Add row',
  removeButtonLabel = 'Remove',
  costWidth = 140,
}: IdCostListEditorProps) {
  const resolvedCostWidth =
    typeof costWidth === 'number' ? `${costWidth}px` : costWidth;

  const updateRowAt = React.useCallback(
    (index: number, patch: Partial<IdCostRowVM>) => {
      const copy = rows.slice();

      if (index < 0 || index >= copy.length) return;
      const current = copy[index];
      if (!current) return;

      const nextRow: IdCostRowVM = {
        category: patch.category ?? current.category,
        cost: patch.cost ?? current.cost,
      };

      copy[index] = nextRow;
      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  const addRow = React.useCallback(() => {
    const next: IdCostRowVM[] = [
      ...rows,
      {
        category: '',
        cost: '',
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

  const showComponent = viewing ? rows.length > 0 || showWhenEmpty : true;
  if (!showComponent) return null;

  return (
    <section style={{ marginTop: 12 }}>
      <h4 style={{ margin: '8px 0' }}>{title}</h4>

      {showActions && (
        <button type="button" onClick={addRow} style={{ marginBottom: 8 }}>{addButtonLabel}</button>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showActions ? 'minmax(280px, 1fr) 160px auto' : 'minmax(280px, 1fr) 160px',
          gap: 8,
        }}
      >
        {rows.length > 0 && <div style={{ fontWeight: 600 }}>{categoryColumnLabel}</div>}
        {rows.length > 0 && <div style={{ fontWeight: 600 }}>{costColumnLabel}</div>}
        {showActions && <div />}

        {rows.map((row, i) => (
          <React.Fragment key={`${title}-${i}`}>
            <LabeledSelect
              label={categoryColumnLabel}
              hideLabel
              ariaLabel={categoryColumnLabel}
              value={row.category}
              onChange={(v) => updateRowAt(i, { category: v })}
              options={categoryOptions}
              disabled={loading || viewing}
            />

            <LabeledInput
              label={costColumnLabel}
              hideLabel
              ariaLabel={costColumnLabel}
              value={row.cost}
              onChange={(v) => updateRowAt(i, { cost: sanitizeCost(v) })}
              disabled={viewing}
              width={resolvedCostWidth}
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