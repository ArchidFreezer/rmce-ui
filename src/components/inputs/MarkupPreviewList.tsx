import * as React from 'react';
import { MarkupPreview } from './MarkupPreview';
import { LabeledInput } from './LabeledInput';

export interface MarkupPreviewListProps {
  title: string;
  arr?: string[];
  format?: 'html' | 'markdown';
  onChangeNotes?: (next: string[]) => void;

  viewing?: boolean | undefined;
  showWhenEmpty?: boolean | undefined;
  error?: string | undefined;

  addButtonLabel?: string | undefined;
  removeButtonLabel?: string | undefined;
}

export function MarkupPreviewList({
  title,
  arr = [],
  onChangeNotes,
  viewing,
  showWhenEmpty = false,
  error,
  addButtonLabel = '+ Add note',
  removeButtonLabel = 'Remove',
  format = 'html',
}: MarkupPreviewListProps) {
  const editable = Boolean(onChangeNotes) && !viewing;

  const updateNoteAt = (index: number, value: string) => {
    if (!onChangeNotes) return;
    const copy = arr.slice();
    if (index < 0 || index >= copy.length) return;
    copy[index] = value;
    onChangeNotes(copy);
  };

  const addNote = () => {
    if (!onChangeNotes) return;
    onChangeNotes([...arr, '']);
  };

  const removeNoteAt = (index: number) => {
    if (!onChangeNotes) return;
    const copy = arr.slice();
    if (index < 0 || index >= copy.length) return;
    copy.splice(index, 1);
    onChangeNotes(copy);
  };

  // Hide completely in view mode if empty
  const showComponent = viewing ? arr && arr.length > 0 || showWhenEmpty : true;
  if (!showComponent) return null;

  return (
    <section style={{ marginTop: 12 }}>
      <h4 style={{ margin: '8px 0' }}>{title}</h4>

      {editable && (
        <button
          type="button"
          onClick={addNote}
          style={{ marginBottom: 8 }}
        >
          {addButtonLabel}
        </button>
      )}

      {arr && arr.map((item, i) => (
        <div
          key={`${title}-${i}`}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 8,
            marginBottom: 8,
          }}
        >
          {editable ? (
            <>
              <LabeledInput
                label={`Note ${i + 1}`}
                hideLabel
                value={item}
                onChange={(v) => updateNoteAt(i, v)}
              />

              <div style={{ marginTop: 6 }}>
                <MarkupPreview
                  content={item}
                  format={format}
                  emptyHint="Empty note"
                />
              </div>

              <button
                type="button"
                onClick={() => removeNoteAt(i)}
                style={{ color: '#b00020', marginTop: 6 }}
              >
                {removeButtonLabel}
              </button>
            </>
          ) : (
            <MarkupPreview
              content={item}
              format={format}
              emptyHint="Empty note"
            />
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