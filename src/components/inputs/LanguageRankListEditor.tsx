import * as React from 'react';
import { LabeledInput } from './LabeledInput';
import { LabeledSelect } from './LabeledSelect';
import { sanitizeUnsignedInt } from '../../utils/inputHelpers';

export type LanguageRankRowVM = {
  language: string | '';
  spoken: string;
  written: string;
  somatic?: string | undefined;
};

export interface LanguageRankListEditorProps {
  title: string;
  rows: LanguageRankRowVM[];
  onChangeRows: (next: LanguageRankRowVM[]) => void;

  /** Options for the language selector */
  languageOptions: Array<{ value: string; label: string }>;

  loading?: boolean | undefined;
  viewing?: boolean | undefined;
  error?: string | undefined;

  /** Whether to show the somatic column. Default: true */
  showSomatic?: boolean | undefined;

  /** Optional labels */
  languageColumnLabel?: string | undefined;
  spokenColumnLabel?: string | undefined;
  writtenColumnLabel?: string | undefined;
  somaticColumnLabel?: string | undefined;

  /** Optional button labels */
  addButtonLabel?: string | undefined;
  removeButtonLabel?: string | undefined;

  /** Optional width overrides */
  spokenWidth?: number | string | undefined;
  writtenWidth?: number | string | undefined;
  somaticWidth?: number | string | undefined;
}


export function LanguageRankListEditor({
  title,
  rows,
  onChangeRows,
  languageOptions,
  loading,
  viewing,
  error,
  showSomatic = true,
  languageColumnLabel = 'Language',
  spokenColumnLabel = 'Spoken',
  writtenColumnLabel = 'Written',
  somaticColumnLabel = 'Somatic',
  addButtonLabel = '+ Add language',
  removeButtonLabel = 'Remove',
  spokenWidth = 100,
  writtenWidth = 100,
  somaticWidth = 100,
}: LanguageRankListEditorProps) {
  const showActions = !viewing;

  const resolvedSpokenWidth =
    typeof spokenWidth === 'number' ? `${spokenWidth}px` : spokenWidth;

  const resolvedWrittenWidth =
    typeof writtenWidth === 'number' ? `${writtenWidth}px` : writtenWidth;

  const resolvedSomaticWidth =
    typeof somaticWidth === 'number' ? `${somaticWidth}px` : somaticWidth;

  const updateRowAt = React.useCallback(
    (index: number, patch: Partial<LanguageRankRowVM>) => {
      const copy = rows.slice();

      if (index < 0 || index >= copy.length) return;
      const current = copy[index];
      if (!current) return;

      const nextRow: LanguageRankRowVM = {
        language: patch.language ?? current.language,
        spoken: patch.spoken ?? current.spoken,
        written: patch.written ?? current.written,
        somatic: Object.prototype.hasOwnProperty.call(patch, 'somatic')
          ? patch.somatic
          : current.somatic,
      };

      copy[index] = nextRow;
      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  const addRow = React.useCallback(() => {
    const next: LanguageRankRowVM[] = [
      ...rows,
      {
        language: '',
        spoken: '',
        written: '',
        somatic: showSomatic ? '' : undefined,
      },
    ];
    onChangeRows(next);
  }, [rows, onChangeRows, showSomatic]);

  const removeRowAt = React.useCallback(
    (index: number) => {
      const copy = rows.slice();

      if (index < 0 || index >= copy.length) return;
      copy.splice(index, 1);

      onChangeRows(copy);
    },
    [rows, onChangeRows],
  );

  const gridTemplateColumns = React.useMemo(() => {
    if (showSomatic) {
      return showActions
        ? `minmax(260px, 1fr) ${resolvedSpokenWidth} ${resolvedWrittenWidth} ${resolvedSomaticWidth} auto`
        : `minmax(260px, 1fr) ${resolvedSpokenWidth} ${resolvedWrittenWidth} ${resolvedSomaticWidth}`;
    }

    return showActions
      ? `minmax(260px, 1fr) ${resolvedSpokenWidth} ${resolvedWrittenWidth} auto`
      : `minmax(260px, 1fr) ${resolvedSpokenWidth} ${resolvedWrittenWidth}`;
  }, [
    showSomatic,
    showActions,
    resolvedSpokenWidth,
    resolvedWrittenWidth,
    resolvedSomaticWidth,
  ]);

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
          gridTemplateColumns,
          gap: 8,
        }}
      >
        {rows.length > 0 && <div style={{ fontWeight: 600 }}>{languageColumnLabel}</div>}
        {rows.length > 0 && <div style={{ fontWeight: 600 }}>{spokenColumnLabel}</div>}
        {rows.length > 0 && <div style={{ fontWeight: 600 }}>{writtenColumnLabel}</div>}
        {showSomatic && rows.length > 0 && <div style={{ fontWeight: 600 }}>{somaticColumnLabel}</div>}
        {showActions && <div />}

        {rows.map((row, i) => (
          <React.Fragment key={`${title}-${i}`}>
            <LabeledSelect
              label={languageColumnLabel}
              hideLabel
              ariaLabel={languageColumnLabel}
              value={row.language}
              onChange={(v) => updateRowAt(i, { language: v })}
              options={languageOptions}
              disabled={loading || viewing}
            />

            <LabeledInput
              label={spokenColumnLabel}
              hideLabel
              ariaLabel={spokenColumnLabel}
              value={row.spoken}
              onChange={(v) => updateRowAt(i, { spoken: sanitizeUnsignedInt(v) })}
              disabled={viewing}
              width={resolvedSpokenWidth}
            />

            <LabeledInput
              label={writtenColumnLabel}
              hideLabel
              ariaLabel={writtenColumnLabel}
              value={row.written}
              onChange={(v) => updateRowAt(i, { written: sanitizeUnsignedInt(v) })}
              disabled={viewing}
              width={resolvedWrittenWidth}
            />

            {showSomatic && (
              <LabeledInput
                label={somaticColumnLabel}
                hideLabel
                ariaLabel={somaticColumnLabel}
                value={row.somatic ?? ''}
                onChange={(v) => updateRowAt(i, { somatic: sanitizeUnsignedInt(v) })}
                disabled={viewing}
                width={resolvedSomaticWidth}
              />
            )}

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

