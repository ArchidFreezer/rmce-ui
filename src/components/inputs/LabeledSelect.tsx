import { useId, type SelectHTMLAttributes } from 'react';

export interface LabeledSelectOption {
  label: string;
  value: string;
  disabled?: boolean | undefined;   // Fix A-compatible
}

export interface LabeledSelectProps {
  label: string;
  hideLabel?: boolean | undefined;
  ariaLabel?: string | undefined;
  value: string;
  onChange: (val: string) => void;

  /** Accept either simple string[] or structured options with labels */
  options: readonly string[] | readonly LabeledSelectOption[];

  disabled?: boolean | undefined;   // Fix A
  id?: string;
  required?: boolean;
  selectProps?: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'disabled' | 'id' | 'required'>;
  error?: string | undefined;       // Fix A
  placeholderOption?: string;
  helperText?: string | undefined;
}

export function LabeledSelect({
  label,
  value,
  hideLabel = false,
  ariaLabel,
  onChange,
  options,
  disabled = false,
  id,
  required,
  selectProps,
  error,
  placeholderOption = '— Select —',
  helperText,
}: LabeledSelectProps) {
  const autoId = useId();
  const selectId = id ?? `ls-${autoId}`;
  const errorId = error ? `${selectId}-error` : undefined;
  const helperId = helperText ? `${selectId}-help` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;
  // Provide accessible name if label is not visible
  const computedAriaLabel =
    (!label || hideLabel) ? (ariaLabel ?? label ?? undefined) : undefined;


  // Normalize options → array of { label, value, disabled? }
  const norm =
    (options as readonly string[]).map
      ? (options as readonly any[]).map((opt) =>
        typeof opt === 'string' ? { label: opt, value: opt } : opt
      )
      : [];

  return (
    <label htmlFor={selectId} style={{ display: 'grid', gap: 6, fontSize: 14 }}>
      {!hideLabel && <span>{label}{required ? ' *' : ''}</span>}
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        aria-label={computedAriaLabel}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        style={{
          padding: 8,
          border: error ? '1px solid #b00020' : '1px solid var(--border)',
          outline: 'none',
          background: 'var(--bg)',
          color: 'var(--text)',
        }}
        {...selectProps}
      >
        <option value="">{placeholderOption}</option>
        {norm.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={!!opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {helperText && !error && (
        <span id={helperId} style={{ color: 'var(--muted)', fontSize: 12 }}>
          {helperText}
        </span>
      )}
      {error && (
        <span id={errorId} style={{ color: '#b00020', fontSize: 12 }}>
          {error}
        </span>
      )}
    </label>
  );
}