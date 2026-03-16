import { useId, type SelectHTMLAttributes } from 'react';

export interface LabeledSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: readonly string[];
  disabled?: boolean | undefined;
  id?: string;
  required?: boolean;
  selectProps?: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'disabled' | 'id' | 'required'>;
  /**
   * EXACT OPTIONAL PROP (Fix A)
   */
  error?: string | undefined;
  /** A placeholder-like first option with empty value */
  placeholderOption?: string | undefined;
  helperText?: string | undefined;
}

export function LabeledSelect({
  label,
  value,
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

  return (
    <label htmlFor={selectId} style={{ display: 'grid', gap: 6, fontSize: 14 }}>
      <span>{label}{required ? ' *' : ''}</span>
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
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
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
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