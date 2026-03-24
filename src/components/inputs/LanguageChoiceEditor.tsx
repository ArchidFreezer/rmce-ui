import * as React from 'react';
import { LabeledInput } from './LabeledInput';

import { LabeledSelect } from './LabeledSelect';

export type LanguageChoiceRowVM<TLanguageId extends string = string> = {
  numChoices: string;
  value: string;
  options: TLanguageId[];
};

export interface LanguageChoiceEditorProps<TLanguageId extends string = string> {
  title: string;
  rows: LanguageChoiceRowVM<TLanguageId>[];
  onChangeRows: (next: LanguageChoiceRowVM<TLanguageId>[]) => void;

  languageOptions: Array<{ value: TLanguageId; label: string }>;

  viewing?: boolean | undefined;
  loading?: boolean | undefined;
  /** Whether to show the component when viewing if there are no rows */
  showWhenEmpty?: boolean | undefined; error?: string | undefined;

  /** Labels */
  numChoicesLabel?: string | undefined;
  valueLabel?: string | undefined;
  optionLabel?: string | undefined;

  /** Buttons */
  addRowLabel?: string | undefined;
  removeRowLabel?: string | undefined;
}

const sanitizeUnsignedInt = (s: string) => s.replace(/[^\d]/g, '');

export function LanguageChoiceEditor<TLanguageId extends string = string>({
  title,
  rows,
  onChangeRows,
  languageOptions,
  viewing,
  loading,
  showWhenEmpty = false,
  error,
  numChoicesLabel = '# Choices',
  valueLabel = 'Ranks',
  optionLabel = 'Language',
  addRowLabel = '+ Add language choice',
  removeRowLabel = 'Remove',
}: LanguageChoiceEditorProps<TLanguageId>) {
  const showActions = !viewing;

  const updateRowAt = React.useCallback(
    (index: number, patch: Partial<LanguageChoiceRowVM<TLanguageId>>) => {
      const copy = rows.slice();

      if (index < 0 || index >= copy.length) return;
      const current = copy[index];
      if (!current) return;

      copy[index] = {
        numChoices: patch.numChoices ?? current.numChoices,
        value: patch.value ?? current.value,
        options: patch.options ?? current.options.slice(),
      };

      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  const addRow = React.useCallback(() => {
    onChangeRows([
      ...rows,
      {
        numChoices: '',
        value: '',
        options: [],
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

  const addOptionAt = (rowIndex: number) => {
    const copy = rows.slice();
    const row = copy[rowIndex];
    if (!row) return;
    copy[rowIndex] = {
      ...row,
      options: [...row.options, '' as TLanguageId],
    };

    onChangeRows(copy);
  };

  const updateOptionAt = (
    rowIndex: number,
    optionIndex: number,
    value: TLanguageId,
  ) => {
    const copy = rows.slice();
    const row = copy[rowIndex];
    if (!row) return;

    const opts = row.options.slice();
    if (optionIndex < 0 || optionIndex >= opts.length) return;

    opts[optionIndex] = value;

    copy[rowIndex] = {
      ...row,
      options: opts,
    };

    onChangeRows(copy);
  };

  const removeOptionAt = (rowIndex: number, optionIndex: number) => {
    const copy = rows.slice();
    const row = copy[rowIndex];
    if (!row) return;

    const opts = row.options.slice();
    if (optionIndex < 0 || optionIndex >= opts.length) return;

    opts.splice(optionIndex, 1);

    copy[rowIndex] = {
      ...row,
      options: opts,
    };

    onChangeRows(copy);
  };

  const showComponent = viewing ? rows.length > 0 || showWhenEmpty : true;
  if (!showComponent) return null;

  return (
    <section style={{ marginTop: 12 }}>
      <h4 style={{ margin: '8px 0' }}>{title}</h4>

      {!viewing && (
        <button type="button" onClick={addRow} style={{ marginBottom: 8 }}>
          {addRowLabel}
        </button>
      )}

      {rows.map((row, rowIndex) => (
        <div
          key={`${title}-${rowIndex}`}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 8,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: showActions
                ? '120px 120px 120px'
                : '120px 120px',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <LabeledInput
              label={numChoicesLabel}
              value={row.numChoices}
              onChange={(v) =>
                updateRowAt(rowIndex, {
                  numChoices: sanitizeUnsignedInt(v),
                })
              }
              disabled={viewing}
              width={100}
            />

            <LabeledInput
              label={valueLabel}
              value={row.value}
              onChange={(v) =>
                updateRowAt(rowIndex, {
                  value: sanitizeUnsignedInt(v),
                })
              }
              disabled={viewing}
              width={100}
            />

            {showActions && (
              <button
                type="button"
                onClick={() => removeRowAt(rowIndex)}
                style={{ color: '#b00020' }}
              >
                {removeRowLabel}
              </button>
            )}
          </div>

          {!viewing && (
            <button
              type="button"
              onClick={() => addOptionAt(rowIndex)}
              style={{ marginBottom: 8 }}
            >
              + Add language
            </button>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: showActions ? '1fr auto' : '1fr',
              gap: 8,
            }}
          >
            {row.options.map((opt, optIndex) => (
              <React.Fragment key={`${rowIndex}-${optIndex}`}>
                <LabeledSelect
                  label={optionLabel}
                  hideLabel
                  ariaLabel={optionLabel}
                  value={opt}
                  options={languageOptions}
                  disabled={loading || viewing}
                  onChange={(v) =>
                    updateOptionAt(rowIndex, optIndex, v as TLanguageId)
                  }
                />

                {showActions && (
                  <button
                    type="button"
                    onClick={() => removeOptionAt(rowIndex, optIndex)}
                    style={{ color: '#b00020' }}
                  >
                    Remove
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
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
