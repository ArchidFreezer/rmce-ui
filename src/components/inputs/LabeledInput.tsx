import { useId, type InputHTMLAttributes } from 'react';

export interface LabeledInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: InputHTMLAttributes<HTMLInputElement>['type']; // 'text' | 'number' | ...
  disabled?: boolean | undefined;
  id?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'disabled' | 'id'>;
  /**
   * EXACT OPTIONAL PROP (Fix A):
   * When tsconfig has "exactOptionalPropertyTypes": true, an optional prop does NOT include undefined
   * unless we state it. This allows passing `error={errors.id}` where type is `string | undefined`.
   */
  error?: string | undefined;
  /** Optional helper text under the field (separate from error) */
  helperText?: string | undefined;
}

export function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
  id,
  placeholder,
  required,
  autoComplete,
  inputProps,
  error,
  helperText,
}: LabeledInputProps) {
  const autoId = useId();
  const inputId = id ?? `li-${autoId}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helperText ? `${inputId}-help` : undefined;

  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  return (
    <label htmlFor={inputId} style={{ display: 'grid', gap: 6, fontSize: 14 }}>
      <span>{label}{required ? ' *' : ''}</span>
      <input
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        style={{
          padding: 8,
          border: error ? '1px solid #b00020' : '1px solid var(--border)',
          outline: 'none',
          background: 'var(--bg)',
          color: 'var(--text)',
        }}
        {...inputProps}
      />
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