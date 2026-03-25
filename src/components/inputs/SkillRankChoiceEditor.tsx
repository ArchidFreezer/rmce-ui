import * as React from 'react';
import { LabeledInput } from './LabeledInput';
import { SkillListEditor } from './SkillListEditor';
import { sanitizeUnsignedInt } from '../../utils/inputHelpers';

export type SkillRankChoiceRowVM = {
  numChoices: string;
  value: string;
  options: {
    id: string;
    subcategory?: string | undefined;
  }[];
};

export interface SkillRankChoiceEditorProps {
  title: string;
  rows: SkillRankChoiceRowVM[];
  onChangeRows: (next: SkillRankChoiceRowVM[]) => void;

  skillOptions: Array<{ value: string; label: string }>;

  viewing?: boolean | undefined;
  showWhenEmpty?: boolean | undefined;
  error?: string | undefined;

  addRowLabel?: string | undefined;
  removeRowLabel?: string | undefined;
}

export function SkillRankChoiceEditor({
  title,
  rows,
  onChangeRows,
  skillOptions,
  viewing,
  showWhenEmpty = false,
  error,
  addRowLabel = '+ Add skill rank choice',
  removeRowLabel = 'Remove',
}: SkillRankChoiceEditorProps) {
  const showActions = !viewing;

  const updateRowAt = React.useCallback(
    (index: number, patch: Partial<SkillRankChoiceRowVM>) => {
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

  const addRow = () => {
    onChangeRows([
      ...rows,
      {
        numChoices: '',
        value: '',
        options: [],
      },
    ]);
  };

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
                ? '120px 120px 120px'
                : '120px 120px',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <LabeledInput
              label="Total Ranks"
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

          {/* Skill options */}
          <SkillListEditor
            title="Skill Options"
            rows={row.options}
            onChangeRows={(opts) =>
              updateRowAt(rowIndex, { options: opts })
            }
            idOptions={skillOptions}
            viewing={viewing}
          />
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