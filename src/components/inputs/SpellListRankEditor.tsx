import * as React from 'react';
import { LabeledInput } from './LabeledInput';
import { LabeledSelect } from './LabeledSelect';

export type SpellListRankRowVM<
  TCategoryId extends string = string,
  TSpellListId extends string = string
> = {
  optionalCategory?: TCategoryId | undefined;
  value: string;
  numChoices: string;
  options: TSpellListId[];
};

export interface SpellListRankEditorProps<
  TCategoryId extends string = string,
  TSpellListId extends string = string
> {
  title: string;
  rows: SpellListRankRowVM<TCategoryId, TSpellListId>[];
  onChangeRows: (
    next: SpellListRankRowVM<TCategoryId, TSpellListId>[],
  ) => void;

  categoryOptions: Array<{ value: TCategoryId; label: string }>;
  spellListOptions: Array<{ value: TSpellListId; label: string }>;

  viewing?: boolean | undefined;
  loading?: boolean | undefined;
  showWhenEmpty?: boolean | undefined;
  error?: string | undefined;

  addRowLabel?: string | undefined;
  removeRowLabel?: string | undefined;
}

const sanitizeUnsignedInt = (s: string) => s.replace(/[^\d]/g, '');

export function SpellListRankEditor<
  TCategoryId extends string = string,
  TSpellListId extends string = string
>({
  title,
  rows,
  onChangeRows,
  categoryOptions,
  spellListOptions,
  viewing,
  showWhenEmpty = false,
  loading,
  error,
  addRowLabel = '+ Add spell list rank',
  removeRowLabel = 'Remove',
}: SpellListRankEditorProps<TCategoryId, TSpellListId>) {
  const showActions = !viewing;

  const updateRowAt = React.useCallback(
    (
      index: number,
      patch: Partial<SpellListRankRowVM<TCategoryId, TSpellListId>>,
    ) => {
      const copy = rows.slice();
      if (index < 0 || index >= copy.length) return;
      const current = copy[index];
      if (!current) return;

      copy[index] = {
        optionalCategory:
          Object.prototype.hasOwnProperty.call(patch, 'optionalCategory')
            ? patch.optionalCategory
            : current.optionalCategory,
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
      {
        optionalCategory: undefined,
        value: '',
        numChoices: '',
        options: [],
      },
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
      options: [...row.options, '' as TSpellListId],
    };

    onChangeRows(copy);
  };

  const updateOptionAt = (
    rowIndex: number,
    optionIndex: number,
    value: TSpellListId,
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
          {/* Header fields */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: showActions
                ? '120px 120px minmax(280px,1fr) 120px'
                : '120px 120px minmax(280px,1fr)',
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

            <LabeledSelect
              label="Optional Category"
              value={row.optionalCategory ?? ''}
              options={categoryOptions}
              disabled={loading || viewing}
              onChange={(v) =>
                updateRowAt(rowIndex, {
                  optionalCategory: v as TCategoryId || undefined,
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

          {/* Spell list options */}
          {!viewing && (
            <button
              type="button"
              onClick={() => addOptionAt(rowIndex)}
              style={{ marginBottom: 8 }}
            >
              + Add spell list
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
                  label="Spell List"
                  hideLabel
                  ariaLabel="Spell List"
                  value={opt}
                  options={spellListOptions}
                  disabled={loading || viewing}
                  onChange={(v) =>
                    updateOptionAt(rowIndex, optIndex, v as TSpellListId)
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
