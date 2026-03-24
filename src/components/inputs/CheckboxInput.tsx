import { useId } from 'react';

export interface CheckboxInputProps {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  id?: string;
  /**
   * When tsconfig has "exactOptionalPropertyTypes": true, an optional prop does NOT include undefined
   * unless we state it. This allows passing `error={errors.id}` where type is `string | undefined`.
   */
  error?: string | undefined;
  /** Optional helper text under the field (separate from error) */
  helperText?: string | undefined;
}

export function CheckboxInput({
  label,
  checked,
  onChange,
  disabled,
  id,
  error,
  helperText,
}: CheckboxInputProps) {
  const autoId = useId();
  const inputId = id ?? `li-${autoId}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helperText ? `${inputId}-help` : undefined;

  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
      <input type="checkbox"
        id={inputId}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={!!error}
        checked={checked} onChange={(e) => onChange(e.target.checked)}
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
      <span>{label}</span>
    </label>
  );
}