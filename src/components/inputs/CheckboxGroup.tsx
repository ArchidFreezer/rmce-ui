import { useId } from 'react';

export type CheckboxOption<T extends string = string> =
  | T
  | { label: string; value: T; disabled?: boolean };

export interface CheckboxGroupProps<T extends string = string> {
  /** Visible label for the group (rendered as <legend>) */
  label: string;

  /** Selected values */
  value: readonly T[];

  /** Options to render: either simple string values or objects with labels */
  options: readonly CheckboxOption<T>[];

  /** Change handler (returns the next selected values) */
  onChange: (next: T[]) => void;

  /** Disable the whole group */
  disabled?: boolean;

  /** Mark as required (cosmetic + ARIA; does not enforce selection) */
  required?: boolean;

  /** Group id (auto-generated if omitted) */
  id?: string;

  /** EXACT OPTIONAL PROP (Fix A) */
  error?: string | undefined;

  /** Helper text below the group (shown when no error present) */
  helperText?: string;

  /** Layout direction (default: 'row') */
  direction?: 'row' | 'column';

  /** Number of columns (applies when direction = 'row'; responsive grid) */
  columns?: number;

  /** Render options inline without grid spacing */
  inline?: boolean;

  /** Show 'Select all' / 'Clear all' utility actions (default: false) */
  showSelectAll?: boolean;

  /** Name attribute for inputs (optional; auto-derived from id if omitted) */
  name?: string;

  /** Custom renderer for labels if you need badges, icons, etc. */
  renderOptionLabel?: (opt: { label: string; value: T; disabled?: boolean | undefined }) => React.ReactNode;
}

export function CheckboxGroup<T extends string = string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  required,
  id,
  error,
  helperText,
  direction = 'row',
  columns,
  inline = false,
  showSelectAll = false,
  name,
  renderOptionLabel,
}: CheckboxGroupProps<T>) {
  const autoId = useId();
  const groupId = id ?? `cbg-${autoId}`;
  const errId = error ? `${groupId}-error` : undefined;
  const helpId = helperText ? `${groupId}-help` : undefined;

  const describedBy = [errId, helpId].filter(Boolean).join(' ') || undefined;
  const groupName = name ?? `${groupId}-name`;

  type Normalized<T extends string> = { label: string; value: T; disabled?: boolean | undefined };
 
  const normalized: Normalized<T>[] = options.map(opt => {
  if (typeof opt === 'string') return { label: opt, value: opt };
  return (typeof opt.disabled === 'boolean')
    ? { label: opt.label, value: opt.value, disabled: opt.disabled }
    : { label: opt.label, value: opt.value };
  });

  const toggle = (v: T) => {
    const has = value.includes(v);
    if (has) {
      onChange(value.filter(x => x !== v) as T[]);
    } else {
      onChange([...(value as T[]), v]);
    }
  };

  const selectAll = () => {
    const all = normalized
      .filter(o => !o.disabled)
      .map(o => o.value) as T[];
    onChange(all);
  };

  const clearAll = () => onChange([]);

  const gridStyles: React.CSSProperties =
    direction === 'column'
      ? { display: 'grid', gap: 8 }
      : inline
      ? { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }
      : {
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(1, columns ?? 3)}, minmax(0, 1fr))`,
          gap: 10,
        };

  return (
    <fieldset
      id={groupId}
      aria-describedby={describedBy}
      aria-invalid={!!error}
      disabled={disabled}
      style={{
        margin: 0,
        padding: 0,
        border: 'none',
        minInlineSize: 0,
      }}
    >
      <legend style={{ fontSize: 14, marginBottom: 6 }}>
        {label}
        {required ? ' *' : ''}
      </legend>

      {showSelectAll && !disabled && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            type="button"
            onClick={selectAll}
            style={{ padding: '2px 8px', border: '1px solid var(--border)', background: 'var(--panel)' }}
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearAll}
            style={{ padding: '2px 8px', border: '1px solid var(--border)', background: 'var(--panel)' }}
          >
            Clear all
          </button>
        </div>
      )}

      <div style={gridStyles} role="group" aria-labelledby={groupId}>
        {normalized.map(opt => {
          const checked = value.includes(opt.value);
          const inputId = `${groupId}-${opt.value}`;
          const isDisabled = disabled || !!opt.disabled;

          return (
            <label
              key={opt.value}
              htmlFor={inputId}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, opacity: isDisabled ? 0.7 : 1 }}
              title={opt.label}
            >
              <input
                id={inputId}
                name={groupName}
                type="checkbox"
                checked={checked}
                onChange={() => toggle(opt.value)}
                disabled={isDisabled}
              />
              <span>
                {renderOptionLabel
                  ? renderOptionLabel(opt)
                  : opt.label}
              </span>
            </label>
          );
        })}
      </div>

      {/* Helper / Error messages */}
      {helperText && !error && (
        <div id={helpId} style={{ marginTop: 6, color: 'var(--muted)', fontSize: 12 }}>
          {helperText}
        </div>
      )}
      {error && (
        <div id={errId} style={{ marginTop: 6, color: '#b00020', fontSize: 12 }}>
          {error}
        </div>
      )}
    </fieldset>
  );
}