import * as React from 'react';
import { LabeledInput } from './LabeledInput';
import { LabeledSelect } from './LabeledSelect';

export type SpellListCategoryRankRowVM<TCategoryId extends string = string> = {
  value: string;        // ranks
  numChoices: string;   // number of choices
  options: TCategoryId[];
};

export interface SpellListCategoryRankEditorProps<
  TCategoryId extends string = string
> {
  title: string;
  rows: SpellListCategoryRankRowVM<TCategoryId>[];
  onChangeRows: (next: SpellListCategoryRankRowVM<TCategoryId>[]) => void;

  categoryOptions: Array<{ value: TCategoryId; label: string }>;

  viewing?: boolean | undefined;
  loading?: boolean | undefined;
  error?: string | undefined;

  addRowLabel?: string | undefined;
  removeRowLabel?: string | undefined;
}

const sanitizeUnsignedInt = (s: string) => s.replace(/[^\d]/g, '');

export function SpellListCategoryRankEditor<
  TCategoryId extends string = string
>({
  title,
  rows,
  onChangeRows,
  categoryOptions,
  viewing,
  loading,
  error,
  addRowLabel = '+ Add category rank choice',
  removeRowLabel = 'Remove',
}: SpellListCategoryRankEditorProps<TCategoryId>) {
  const showActions = !viewing;

  const updateRowAt = React.useCallback(
    (
      index: number,
      patch: Partial<SpellListCategoryRankRowVM<TCategoryId>>,
    ) => {
      const copy = rows.slice();
      if (index < 0 || index >= copy.length) return;
      const current = copy[index];
      if (!current) return;

      copy[index] = {
        value: patch.value ?? current.value,
        numChoices: patch.numChoices ?? current.numChoices,
        options: patch.options ?? current.options.slice(),
      };

      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  const addRow = React.useCallback(() => {
    onChangeRows([
      ...rows,
      { value: '', numChoices: '', options: [] },
    ]);
  }, [rows, onChangeRows]);

  const removeRowAt = (index: number) => {
    const copy = rows.slice();
    if (index < 0 || index >= copy.length) return;
    copy.splice(index, 1);
    onChangeRows(copy);
  };

  const addOptionAt = (rowIndex: number) => {
    const copy = rows.slice();
    const row = copy[rowIndex];
    if (!row) return;

    copy[rowIndex] = {
      ...row,
      options: [...row.options, '' as TCategoryId],
    };

    onChangeRows(copy);
  };

  const updateOptionAt = (
    rowIndex: number,
    optionIndex: number,
    value: TCategoryId,
  ) => {
    const copy = rows.slice();
    const row = copy[rowIndex];
    if (!row) return;

    const opts = row.options.slice();
    if (optionIndex < 0 || optionIndex >= opts.length) return;

    opts[optionIndex] = value;

    copy[rowIndex] = { ...row, options: opts };
    onChangeRows(copy);
  };

  const removeOptionAt = (rowIndex: number, optionIndex: number) => {
    const copy = rows.slice();
    const row = copy[rowIndex];
    if (!row) return;

    const opts = row.options.slice();
    if (optionIndex < 0 || optionIndex >= opts.length) return;

    opts.splice(optionIndex, 1);

    copy[rowIndex] = { ...row, options: opts };
    onChangeRows(copy);
  };

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
                ? '120px 120px auto'
                : '120px 120px',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <LabeledInput
              label="Ranks"
              value={row.value}
              disabled={viewing}
              width={100}
              onChange={(v) =>
                updateRowAt(rowIndex, {
                  value: sanitizeUnsignedInt(v),
                })
              }
            />

            <LabeledInput
              label="# Choices"
              value={row.numChoices}
              disabled={viewing}
              width={100}
              onChange={(v) =>
                updateRowAt(rowIndex, {
                  numChoices: sanitizeUnsignedInt(v),
                })
              }
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
              + Add category
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
                  label="Category"
                  hideLabel
                  value={opt}
                  options={categoryOptions}
                  disabled={loading || viewing}
                  onChange={(v) =>
                    updateOptionAt(rowIndex, optIndex, v as TCategoryId)
                  }
                />

                {showActions && (
                  <button
                    type="button"
                    onClick={() =>
                      removeOptionAt(rowIndex, optIndex)
                    }
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