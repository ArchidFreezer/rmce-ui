import * as React from 'react';

export interface LabeledInputProps {
  /** The visible label. Optional to allow compact grid cells. */
  label?: string | undefined;

  /** Input value */
  value: string;

  /**
   * Preferred: string-based change handler (new code).
   * Called with e.target.value on each change.
   */
  onChange?: (val: string) => void;

  /**
   * Event-based change handler (old code still works).
   * If provided, it will be called with the original event.
   */
  onChangeEvent?: (e: React.ChangeEvent<HTMLInputElement>) => void;

  /** Optional explicit accessible name if you hide the label */
  ariaLabel?: string | undefined;

  /** Hide the label element (useful for dense grids). Defaults to false. */
  hideLabel?: boolean | undefined;

  /** Common input attributes you use elsewhere */
  type?: React.InputHTMLAttributes<HTMLInputElement>['type'];
  id?: string | undefined;
  placeholder?: string | undefined;
  required?: boolean | undefined;
  autoComplete?: string | undefined;
  disabled?: boolean | undefined;

  /**
   * Extra attributes to spread onto the underlying <input>.
   * We omit the ones controlled by this component.
   */
  inputProps?: Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'disabled' | 'id' | 'type' | 'aria-label' | 'aria-invalid' | 'required'
  >;

  /** Validation UI */
  error?: string | undefined;
  helperText?: string | undefined;

  /** Optional className/style hooks */
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
}

export function LabeledInput({
  label,
  value,
  onChange,
  onChangeEvent,
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
  // Derive an accessible label when the visual label is hidden or missing
  const computedAriaLabel =
    (!label || hideLabel) ? (ariaLabel ?? label ?? undefined) : undefined;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) onChange(e.target.value);
    if (onChangeEvent) onChangeEvent(e);
  };

  return (
    <label
      className={className}
      style={{ display: 'grid', gap: 6, ...(style ?? {}) }}
    >
      {/* Render label only if provided and not hidden */}
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