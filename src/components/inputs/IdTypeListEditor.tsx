import * as React from 'react';
import { LabeledSelect } from './LabeledSelect';

export type IdTypeRowVM<TId extends string = string, TType extends string = string> = {
  id: TId | '';
  value: TType | '';
};

export interface IdTypeListEditorProps<
  TId extends string = string,
  TType extends string = string
> {
  title: string;
  rows: IdTypeRowVM<TId, TType>[];
  onChangeRows: (next: IdTypeRowVM<TId, TType>[]) => void;

  /** Options for the ID column */
  idOptions: Array<{ value: TId; label: string }>;

  /** Options for the Type column */
  typeOptions: Array<{ value: TType; label: string }>;

  loading?: boolean | undefined;
  viewing?: boolean | undefined;
  /** Whether to show the component when viewing if there are no rows */
  showWhenEmpty?: boolean | undefined;

  error?: string | undefined;

  /** Optional labels */
  idColumnLabel?: string | undefined;
  typeColumnLabel?: string | undefined;

  /** Optional button labels */
  addButtonLabel?: string | undefined;
  removeButtonLabel?: string | undefined;

  /** Optional layout widths */
  idColumnMinWidth?: number | string | undefined;
  typeColumnWidth?: number | string | undefined;
}

/**
 * IdTypeListEditor component
 * 
 * Renders a list of rows, each containing an ID selected from a dropdown and an associated type selected from another dropdown.
 * The component supports loading and viewing states, and displays error messages when provided.
 * 
 * Allows adding and removing rows, and supports loading and viewing states.
 * @param param0  Props for the IdTypeListEditor component
 * @returns JSX.Element
 */
export function IdTypeListEditor<
  TId extends string = string,
  TType extends string = string
>({
  title,
  rows,
  onChangeRows,
  idOptions,
  typeOptions,
  loading,
  viewing,
  showWhenEmpty = false,
  error,
  idColumnLabel = 'ID',
  typeColumnLabel = 'Type',
  addButtonLabel = '+ Add row',
  removeButtonLabel = 'Remove',
  idColumnMinWidth = 280,
  typeColumnWidth = 220,
}: IdTypeListEditorProps<TId, TType>) {
  const showActions = !viewing;

  const resolvedIdColumnWidth =
    typeof idColumnMinWidth === 'number'
      ? `${idColumnMinWidth}px`
      : idColumnMinWidth;

  const resolvedTypeColumnWidth =
    typeof typeColumnWidth === 'number'
      ? `${typeColumnWidth}px`
      : typeColumnWidth;

  const updateRowAt = React.useCallback(
    (index: number, patch: Partial<IdTypeRowVM<TId, TType>>) => {
      const copy = rows.slice();

      if (index < 0 || index >= copy.length) return;
      const current = copy[index];
      if (!current) return;

      const nextRow: IdTypeRowVM<TId, TType> = {
        id: patch.id ?? current.id,
        value: patch.value ?? current.value,
      };

      copy[index] = nextRow;
      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  const addRow = React.useCallback(() => {
    const next: IdTypeRowVM<TId, TType>[] = [
      ...rows,
      {
        id: '',
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
            ? `minmax(${resolvedIdColumnWidth}, 1fr) ${resolvedTypeColumnWidth} auto`
            : `minmax(${resolvedIdColumnWidth}, 1fr) ${resolvedTypeColumnWidth}`,
          gap: 8,
        }}
      >
        {rows.length > 0 && <div style={{ fontWeight: 600 }}>{idColumnLabel}</div>}
        {rows.length > 0 && <div style={{ fontWeight: 600 }}>{typeColumnLabel}</div>}
        {showActions && <div />}

        {rows.map((row, i) => (
          <React.Fragment key={`${title}-${i}`}>
            <LabeledSelect
              label={idColumnLabel}
              hideLabel
              ariaLabel={idColumnLabel}
              value={row.id}
              onChange={(v) => updateRowAt(i, { id: v as TId })}
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