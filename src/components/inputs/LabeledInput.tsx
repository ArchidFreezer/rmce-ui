import * as React from 'react';

export interface LabeledInputProps {
  /** Optional visible label (omit or hide for compact grid rows). */
  label?: string | undefined;

  /** Controlled value. */
  value: string;

  /**
   * String-based change handler (preferred + legacy-compatible).
   * Your legacy forms can keep passing `onChange={(val) => ...}`.
   */
  onChange?: (val: string) => void;

  /**
   * Event-based change handler (optional).
   * Use only when you need the native ChangeEvent.
   */
  onChangeEvent?: (e: React.ChangeEvent<HTMLInputElement>) => void;

  /** If you hide the visual label, provide an accessible name. */
  ariaLabel?: string | undefined;

  /** Hide the visual label (but keep accessible name via ariaLabel/label). */
  hideLabel?: boolean | undefined;

  /** Common input attributes */
  type?: React.InputHTMLAttributes<HTMLInputElement>['type'];
  id?: string | undefined;
  placeholder?: string | undefined;
  required?: boolean | undefined;
  autoComplete?: string | undefined;
  disabled?: boolean | undefined;

  /**
   * Extra input props (excluding those controlled here).
   * Kept strict for exactOptionalPropertyTypes.
   */
  inputProps?: Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'disabled' | 'id' | 'type' | 'aria-label' | 'aria-invalid' | 'required'
  >;

  /** Validation helpers */
  error?: string | undefined;
  helperText?: string | undefined;

  /** Optional styling hooks */
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
}

export function LabeledInput({
  label,
  value,
  onChange,         // string handler (legacy + new)
  onChangeEvent,    // event handler (optional)
  ariaLabel,
  hideLabel = false,
  type = 'text',
  id,
  placeholder,
  required,
  autoComplete,
  disabled,
  inputProps,
  error,
  helperText,
  className,
  style,
}: LabeledInputProps) {
  // Provide accessible name if label is not visible
  const computedAriaLabel =
    (!label || hideLabel) ? (ariaLabel ?? label ?? undefined) : undefined;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 1) Call the string handler first (legacy screens expect this).
    if (onChange) onChange(e.target.value);
    // 2) Then call the optional event handler if present.
    if (onChangeEvent) onChangeEvent(e);
  };

  return (
    <label
      className={className}
      style={{ display: 'grid', gap: 6, ...(style ?? {}) }}
    >
      {/* Only render a visible label if provided and not hidden */}
      {(!hideLabel && label) ? (
        <span>
          {label}
          {required ? ' *' : ''}
        </span>
      ) : null}

      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-label={computedAriaLabel}
        aria-invalid={!!error}
        onChange={handleChange}
        {...inputProps}
      />

      {helperText && !error && (
        <small style={{ color: 'var(--muted)' }}>{helperText}</small>
      )}
      {error && (
        <small style={{ color: '#b00020' }}>{error}</small>
      )}
    </label>
  );
}