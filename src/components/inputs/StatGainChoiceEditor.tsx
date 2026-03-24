import * as React from 'react';
import { LabeledInput } from './LabeledInput';
import { LabeledSelect } from './LabeledSelect';
import { sanitizeUnsignedInt } from '../../utils/inputHelpers';

export interface StatGainChoiceVM<TStat extends string = string> {
  numChoices: string;
  options: TStat[];
}

export interface StatGainChoiceEditorProps<TStat extends string = string> {
  title: string;

  value?: StatGainChoiceVM<TStat> | undefined;
  onChange: (next: StatGainChoiceVM<TStat> | undefined) => void;

  statOptions: Array<{ value: TStat; label: string }>;

  viewing?: boolean | undefined;
  /** Whether to show the component when viewing if there are no rows */
  showWhenEmpty?: boolean | undefined;
  error?: string | undefined;

  addLabel?: string | undefined;
  removeLabel?: string | undefined;
}

export function StatGainChoiceEditor<TStat extends string = string>({
  title,
  value,
  onChange,
  statOptions,
  viewing,
  error,
  addLabel = '+ Add stat gain choice',
  removeLabel = 'Remove stat gain choice',
  showWhenEmpty = false,
}: StatGainChoiceEditorProps<TStat>) {
  const showActions = !viewing;

  const update = (patch: Partial<StatGainChoiceVM<TStat>>) => {
    if (!value) return;
    onChange({
      numChoices: patch.numChoices ?? value.numChoices,
      options: patch.options ?? value.options.slice(),
    });
  };

  const addChoice = () => {
    onChange({
      numChoices: '',
      options: [],
    });
  };

  const removeChoice = () => {
    onChange(undefined);
  };

  const addOption = () => {
    if (!value) return;
    update({ options: [...value.options, '' as TStat] });
  };

  const updateOption = (index: number, stat: TStat) => {
    if (!value) return;
    const opts = value.options.slice();
    if (index < 0 || index >= opts.length) return;
    opts[index] = stat;
    update({ options: opts });
  };

  const removeOption = (index: number) => {
    if (!value) return;
    const opts = value.options.slice();
    if (index < 0 || index >= opts.length) return;
    opts.splice(index, 1);
    update({ options: opts });
  };

  const showComponent = viewing ? value || showWhenEmpty : true;
  if (!showComponent) return null;

  return (
    <section style={{ marginTop: 12 }}>
      <h4 style={{ margin: '8px 0' }}>{title}</h4>

      {!value && !viewing && (
        <button type="button" onClick={addChoice}>
          {addLabel}
        </button>
      )}

      {value && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 8,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: showActions
                ? '120px 160px'
                : '120px',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <LabeledInput
              label="# Choices"
              value={value.numChoices}
              disabled={viewing}
              width={100}
              onChange={(v) =>
                update({ numChoices: sanitizeUnsignedInt(v) })
              }
            />

            {showActions && (
              <button
                type="button"
                onClick={removeChoice}
                style={{ color: '#b00020' }}
              >
                {removeLabel}
              </button>
            )}
          </div>

          {!viewing && (
            <button
              type="button"
              onClick={addOption}
              style={{ marginBottom: 8 }}
            >
              + Add stat
            </button>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: showActions ? '1fr auto' : '1fr',
              gap: 8,
            }}
          >
            {value.options.map((opt, i) => (
              <React.Fragment key={i}>
                <LabeledSelect
                  label="Stat"
                  hideLabel
                  ariaLabel="Stat"
                  value={opt}
                  options={statOptions}
                  disabled={viewing}
                  onChange={(v) => updateOption(i, v as TStat)}
                />

                {showActions && (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    style={{ color: '#b00020' }}
                  >
                    Remove
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: '#b00020', marginTop: 6 }}>
          {error}
        </div>
      )}
    </section>
  );
}
