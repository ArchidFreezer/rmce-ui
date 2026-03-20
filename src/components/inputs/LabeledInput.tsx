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

  /** Accessibility helpers (recommended when label is visually hidden). */
  ariaLabel?: string | undefined;
  hideLabel?: boolean | undefined;

  /** Common input attributes */
  type?: React.InputHTMLAttributes<HTMLInputElement>['type'];
  id?: string | undefined;
  placeholder?: string | undefined;
  required?: boolean | undefined;
  autoComplete?: string | undefined;
  disabled?: boolean | undefined;

  /**
   * Quick way to size the input itself. Examples: '72px', 80, '6rem'.
   * If provided as a number, it's treated as pixels.
   */
  width?: number | string | undefined;

  /**
   * Fine-grained styling/class hooks.
   * - inputStyle / inputClassName target only the <input> element
   * - containerStyle / containerClassName target the outer <label> wrapper
   */
  inputStyle?: React.CSSProperties | undefined;
  inputClassName?: string | undefined;
  containerStyle?: React.CSSProperties | undefined;
  containerClassName?: string | undefined;

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

  /** Optional styling hook for the whole control (legacy; prefer containerStyle) */
  style?: React.CSSProperties | undefined;
  className?: string | undefined;
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

  width,
  inputStyle,
  inputClassName,
  containerStyle,
  containerClassName,

  inputProps,
  error,
  helperText,

  // legacy hooks for the whole control
  style,
  className,
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

  // Normalize width to CSS string if number was provided
  const resolvedWidth =
    typeof width === 'number' ? `${width}px` : width;

  return (
    <label
      className={[className, containerClassName].filter(Boolean).join(' ') || undefined}
      style={{
        display: 'grid',
        gap: 6,
        ...(style ?? {}),
        ...(containerStyle ?? {}),
      }}
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
        className={inputClassName}
        style={{
          // width applies to the INPUT (not the outer label)
          ...(resolvedWidth ? { width: resolvedWidth } : {}),
          ...(inputStyle ?? {}),
        }}
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