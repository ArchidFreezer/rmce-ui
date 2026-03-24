import * as React from 'react';
import { LabeledInput } from './LabeledInput';
import { sanitizeUnsignedInt } from '../../utils/inputHelpers';

export type TextNumberRowVM = {
  text: string;
  number: string;
};

export interface TextNumberListEditorProps {
  title: string;
  rows: TextNumberRowVM[];
  onChangeRows: (next: TextNumberRowVM[]) => void;

  viewing?: boolean | undefined;
  /** Whether to show the component when viewing if there are no rows */
  showWhenEmpty?: boolean | undefined;
  error?: string | undefined;

  /** Column labels */
  textLabel: string;
  numberLabel: string;

  /** Button labels */
  addButtonLabel?: string | undefined;
  removeButtonLabel?: string | undefined;

  /** Optional widths */
  numberWidth?: number | string | undefined;
}

export function TextNumberListEditor({
  title,
  rows,
  onChangeRows,
  viewing,
  showWhenEmpty = false,
  error,
  textLabel,
  numberLabel,
  addButtonLabel = '+ Add row',
  removeButtonLabel = 'Remove',
  numberWidth = 120,
}: TextNumberListEditorProps) {
  const showActions = !viewing;

  const updateRowAt = React.useCallback(
    (index: number, patch: Partial<TextNumberRowVM>) => {
      const copy = rows.slice();
      if (index < 0 || index >= copy.length) return;
      const current = copy[index];
      if (!current) return;

      copy[index] = {
        text: patch.text ?? current.text,
        number: patch.number ?? current.number,
      };

      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  const addRow = React.useCallback(() => {
    onChangeRows([...rows, { text: '', number: '' }]);
  }, [rows, onChangeRows]);

  const removeRowAt = (index: number) => {
    const copy = rows.slice();
    if (index < 0 || index >= copy.length) return;
    copy.splice(index, 1);
    onChangeRows(copy);
  };

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
          gridTemplateColumns: showActions
            ? '1fr 1fr auto'
            : '1fr 1fr',
          gap: 8,
        }}
      >
        {rows.length > 0 && (
          <>
            <div style={{ fontWeight: 600 }}>{textLabel}</div>
            <div style={{ fontWeight: 600 }}>{numberLabel}</div>
            {showActions && <div />}
          </>
        )}

        {rows.map((row, i) => (
          <React.Fragment key={`${title}-${i}`}>
            <LabeledInput
              label={textLabel}
              hideLabel
              value={row.text}
              disabled={viewing}
              onChange={(v) => updateRowAt(i, { text: v })}
            />

            <LabeledInput
              label={numberLabel}
              hideLabel
              value={row.number}
              disabled={viewing}
              width={numberWidth}
              onChange={(v) =>
                updateRowAt(i, { number: sanitizeUnsignedInt(v), })
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