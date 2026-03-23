import * as React from 'react';
import { LabeledInput } from './LabeledInput';

import { sanitizeUnsignedInt } from '../../utils/inputHelpers';

export function ChoiceListEditor<TType extends string = string, TOption = string>({
  title,
  rows,
  onChangeRows,
  typeOptions,
  viewing,
  error,
  createEmptyOption,
  createEmptyRow,
  renderOptionEditor,
  numChoicesLabel = 'Num Choices',
  typeLabel = 'Type',
  optionSectionLabel = 'Options',
  addRowButtonLabel = '+ Add row',
  removeRowButtonLabel = 'Remove row',
  addOptionButtonLabel = '+ Add option',
  numChoicesWidth = 120,
  typeWidth = 220,
}: ChoiceListEditorProps<TType, TOption>) {
  const resolvedNumChoicesWidth =
    typeof numChoicesWidth === 'number' ? `${numChoicesWidth}px` : numChoicesWidth;

  const resolvedTypeWidth =
    typeof typeWidth === 'number' ? `${typeWidth}px` : typeWidth;

  const makeEmptyRow = React.useCallback((): ChoiceListRowVM<TType, TOption> => {
    if (createEmptyRow) return createEmptyRow();
    return {
      numChoices: '',
      type: '',
      options: [],
    };

  }, [createEmptyRow]);

  const updateRowAt = React.useCallback(
    (index: number, patch: Partial<ChoiceListRowVM<TType, TOption>>) => {
      const copy = rows.slice();

      if (index < 0 || index >= copy.length) return;
      const current = copy[index];
      if (!current) return;

      const nextRow: ChoiceListRowVM<TType, TOption> = {
        numChoices: patch.numChoices ?? current.numChoices,
        type: patch.type ?? current.type,
        options: patch.options ?? current.options.slice(),
      };

      copy[index] = nextRow;
      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  const addRow = React.useCallback(() => {
    const next = [...rows, makeEmptyRow()];
    onChangeRows(next);
  }, [rows, onChangeRows, makeEmptyRow]);

  const removeRowAt = React.useCallback(
    (index: number) => {
      const copy = rows.slice();

      if (index < 0 || index >= copy.length) return;
      copy.splice(index, 1);

      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  const addOptionAt = React.useCallback(
    (rowIndex: number) => {
      const copy = rows.slice();

      if (rowIndex < 0 || rowIndex >= copy.length) return;
      const current = copy[rowIndex];
      if (!current) return;

      copy[rowIndex] = {
        numChoices: current.numChoices,
        type: current.type,
        options: [...current.options, createEmptyOption()],
      };

      onChangeRows(copy);
    },
    [rows, onChangeRows, createEmptyOption],
  );

  const setOptionAt = React.useCallback(
    (rowIndex: number, optionIndex: number, nextOption: TOption) => {
      const copy = rows.slice();

      if (rowIndex < 0 || rowIndex >= copy.length) return;
      const current = copy[rowIndex];
      if (!current) return;

      const nextOptions = current.options.slice();
      if (optionIndex < 0 || optionIndex >= nextOptions.length) return;

      nextOptions[optionIndex] = nextOption;

      copy[rowIndex] = {
        numChoices: current.numChoices,
        type: current.type,
        options: nextOptions,
      };

      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  const removeOptionAt = React.useCallback(
    (rowIndex: number, optionIndex: number) => {
      const copy = rows.slice();

      if (rowIndex < 0 || rowIndex >= copy.length) return;
      const current = copy[rowIndex];
      if (!current) return;

      const nextOptions = current.options.slice();
      if (optionIndex < 0 || optionIndex >= nextOptions.length) return;

      nextOptions.splice(optionIndex, 1);

      copy[rowIndex] = {
        numChoices: current.numChoices,
        type: current.type,
        options: nextOptions,
      };

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
          {addRowButtonLabel}
        </button>
      )}

      {rows.map((row, rowIndex) => (
        <div
          key={`${title}-${rowIndex}`}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 8,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `${resolvedNumChoicesWidth} ${resolvedTypeWidth}`,
              gap: 8,
              marginBottom: 8,
            }}
          >
            <LabeledInput
              label={numChoicesLabel}
              value={row.numChoices}
              onChange={(v) =>
                updateRowAt(rowIndex, { numChoices: sanitizeUnsignedInt(v) })
              }
              disabled={viewing}
              width={resolvedNumChoicesWidth}
            />

            {typeOptions.length > 0 && (
              <LabeledSelect
                label={typeLabel}
                value={row.type}
                onChange={(v) =>
                  updateRowAt(rowIndex, { type: v as TType })
                }
                options={typeOptions}
                disabled={viewing}
              />
            )}
          </div>

          <div style={{ marginTop: 8 }}>
            <strong>{optionSectionLabel}</strong>
          </div>

          {!viewing && (
            <button
              type="button"
              onClick={() => addOptionAt(rowIndex)}
              style={{ margin: '8px 0' }}
            >
              {addOptionButtonLabel}
            </button>
          )}

          <div style={{ display: 'grid', gap: 8 }}>
            {row.options.map((option, optionIndex) =>
              renderOptionEditor({
                rowIndex,
                optionIndex,
                option,
                row,
                viewing,
                setOption: (nextOption) =>
                  setOptionAt(rowIndex, optionIndex, nextOption),
                removeOption: () =>
                  removeOptionAt(rowIndex, optionIndex),
              }),
            )}
          </div>

          {!viewing && (
            <button
              type="button"
              onClick={() => removeRowAt(rowIndex)}
              style={{ color: '#b00020', marginTop: 8 }}
            >
              {removeRowButtonLabel}
            </button>
          )}
        </div>
      ))}

      {error && (
        <div style={{ color: '#b00020', marginTop: 6 }}>
          {error}
        </div>
      )}
    </section>
  );
}

import { LabeledSelect } from './LabeledSelect';

export type ChoiceListRowVM<TType extends string = string, TOption = string> = {
  numChoices: string;
  type: TType | '';
  options: TOption[];
};

export interface ChoiceListEditorProps<TType extends string = string, TOption = string> {
  title: string;
  rows: ChoiceListRowVM<TType, TOption>[];
  onChangeRows: (next: ChoiceListRowVM<TType, TOption>[]) => void;

  /** Options for the "type" selector */
  typeOptions: Array<{ value: TType; label: string }>;

  /** Whether the form is in view-only mode */
  viewing?: boolean | undefined;

  /** Validation error for the whole section */
  error?: string | undefined;

  /** Creates a new empty option item when +Add Option is clicked */
  createEmptyOption: () => TOption;

  /** Optional row factory; defaults to { numChoices:'', type:'', options:[] } */
  createEmptyRow?: () => ChoiceListRowVM<TType, TOption>;

  /**
   * Renders one option editor row.
   * The parent fully controls how each option row is edited.
   */
  renderOptionEditor: (args: {
    rowIndex: number;
    optionIndex: number;
    option: TOption;
    row: ChoiceListRowVM<TType, TOption>;
    viewing?: boolean | undefined;
    setOption: (nextOption: TOption) => void;
    removeOption: () => void;
  }) => React.ReactNode;

  /** Labels */
  numChoicesLabel?: string | undefined;
  typeLabel?: string | undefined;
  optionSectionLabel?: string | undefined;

  /** Buttons */
  addRowButtonLabel?: string | undefined;
  removeRowButtonLabel?: string | undefined;
  addOptionButtonLabel?: string | undefined;

  /** Layout */
  numChoicesWidth?: number | string | undefined;
  typeWidth?: number | string | undefined;
}


