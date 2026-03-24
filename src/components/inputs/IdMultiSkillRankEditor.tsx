import * as React from 'react';
import { LabeledInput } from './LabeledInput';
import { LabeledSelect } from './LabeledSelect';

export type IdMultiSkillRankRowVM<TId extends string = string> = {
  id: TId | '';
  value: string;
  numChoices: string;
};

export interface IdMultiSkillRankEditorProps<TId extends string = string> {
  title: string;
  rows: IdMultiSkillRankRowVM<TId>[];
  onChangeRows: (next: IdMultiSkillRankRowVM<TId>[]) => void;

  /** Options for the ID selector (categories or groups) */
  idOptions: Array<{ value: TId; label: string }>;

  loading?: boolean | undefined;
  viewing?: boolean | undefined;
  showWhenEmpty?: boolean | undefined;
  error?: string | undefined;

  /** Optional labels */
  idColumnLabel?: string | undefined;
  valueColumnLabel?: string | undefined;
  numChoicesColumnLabel?: string | undefined;

  /** Buttons */
  addButtonLabel?: string | undefined;
  removeButtonLabel?: string | undefined;

  /** Layout */
  idColumnMinWidth?: number | string | undefined;
}

const sanitizeUnsignedInt = (s: string) => s.replace(/[^\d]/g, '');

export function IdMultiSkillRankEditor<TId extends string = string>({
  title,
  rows,
  onChangeRows,
  idOptions,
  loading,
  viewing,
  showWhenEmpty = false,

  error,
  idColumnLabel = 'ID',
  valueColumnLabel = 'Ranks',
  numChoicesColumnLabel = '# Choices',
  addButtonLabel = '+ Add row',
  removeButtonLabel = 'Remove',
  idColumnMinWidth = 280,
}: IdMultiSkillRankEditorProps<TId>) {
  const showActions = !viewing;

  const resolvedIdWidth =
    typeof idColumnMinWidth === 'number'
      ? `${idColumnMinWidth}px`
      : idColumnMinWidth;

  const updateRowAt = React.useCallback(
    (index: number, patch: Partial<IdMultiSkillRankRowVM<TId>>) => {
      const copy = rows.slice();

      if (index < 0 || index >= copy.length) return;
      const current = copy[index];
      if (!current) return;

      copy[index] = {
        id: patch.id ?? current.id,
        value: patch.value ?? current.value,
        numChoices: patch.numChoices ?? current.numChoices,
      };

      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  const addRow = React.useCallback(() => {
    onChangeRows([
      ...rows,
      {
        id: '',
        value: '',
        numChoices: '',
      },
    ]);
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
        <button type="button" onClick={addRow} style={{ marginBottom: 8 }}>
          {addButtonLabel}
        </button>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showActions ? `minmax(${resolvedIdWidth}, 1fr) 160px 160px auto` : `minmax(${resolvedIdWidth}, 1fr) 160px 160px`,
          gap: 8,
        }}
      >
        {rows.length > 0 && (
          <>
            <div style={{ fontWeight: 600 }}>{idColumnLabel}</div>
            <div style={{ fontWeight: 600 }}>{valueColumnLabel}</div>
            <div style={{ fontWeight: 600 }}>{numChoicesColumnLabel}</div>
            {showActions && <div />}
          </>
        )}

        {rows.map((row, i) => (
          <React.Fragment key={`${title}-${i}`}>
            <LabeledSelect
              label={idColumnLabel}
              hideLabel
              ariaLabel={idColumnLabel}
              value={row.id}
              options={idOptions}
              disabled={loading || viewing}
              onChange={(v) => updateRowAt(i, { id: v as TId })}
            />

            <LabeledInput
              label={valueColumnLabel}
              hideLabel
              ariaLabel={valueColumnLabel}
              value={row.value}
              disabled={viewing}
              width={100}
              onChange={(v) =>
                updateRowAt(i, { value: sanitizeUnsignedInt(v) })
              }
            />

            <LabeledInput
              label={numChoicesColumnLabel}
              hideLabel
              ariaLabel={numChoicesColumnLabel}
              value={row.numChoices}
              disabled={viewing}
              width={100}
              onChange={(v) =>
                updateRowAt(i, { numChoices: sanitizeUnsignedInt(v) })
              }
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