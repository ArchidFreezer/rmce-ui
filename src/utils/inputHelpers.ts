// Reusable helpers for forms with exactOptionalPropertyTypes = true

/* =========================================================================
   Signed integers
   ========================================================================= */

/** Sanitize to a signed-integer-in-progress string.
 * Keeps at most one leading '-', strips other non-digits. Allows '-' transiently.
 * Examples:
 *  '' -> ''
 *  '-' -> '-'
 *  '-0' -> '-0'
 *  '--12x' -> '-12'
 *  '1-2' -> '12'
 */
export function sanitizeSignedInt(input: string): string {
  // 1) Remove everything except digits and '-'
  let raw = input.replace(/[^-\d]+/g, '');
  // 2) Keep only the first '-' if present
  const firstDash = raw.indexOf('-');
  if (firstDash !== -1) {
    raw = '-' + raw.slice(firstDash + 1).replace(/-/g, '');
  }
  return raw;
}

/**
 * Create an onChange handler for a signed-integer field stored as string in state.
 * The handler will sanitize the input to allow only digits and an optional leading '-', ensuring the value is always a valid signed integer string (or empty for in-progress).
 * Examples:
 *  onChange('12') -> '12'
 *  onChange('-7') -> '-7'
 *  onChange('abc') -> ''
 *  onChange('1-2') -> '12'
 *  onChange('--3') -> '-3'
 *  onChange('') -> ''
 */
export function makeSignedIntOnChange<T extends Record<string, any>>(
  field: keyof T,
  setForm: React.Dispatch<React.SetStateAction<T>>
) {
  return (v: string) => {
    setForm((s) => ({
      ...s,
      [field]: sanitizeSignedInt(v),
    }));
  };
}

/**
 * Validate final signed integer string (no empty, no lone '-').
 * Accepts "0", "-7", "123", but not "", "-", "3.14", "abc".
 */
export function isValidSignedInt(s: string): boolean {
  return /^-?\d+$/.test(s);
}

/* =========================================================================
   Unsigned integers
   ========================================================================= */

/**
 * Sanitize to a non-negative integer-in-progress string (digits only).
 * Allows only digits, ensuring the value is always a valid non-negative integer string (or empty for in-progress).
 * Examples:
 *  '' -> ''
 *  '0' -> '0'
 *  '123' -> '123'
 *  'abc' -> ''
 *  '1-2' -> '12'
 *  '3.14' -> '314'
 *  '-5' -> '5'
 */
export function sanitizeUnsignedInt(input: string): string {
  return input.replace(/[^\d]/g, '');
}

/**
 * Create an onChange handler for a non-negative integer field stored as string.
 * The handler will sanitize the input to allow only digits, ensuring the value is always a valid non-negative integer string (or empty for in-progress).
 * Examples:
 *  onChange('12') -> '12'
 *  onChange('abc') -> ''
 *  onChange('1-2') -> '12'
 *  onChange('3.14') -> '314'
 *  onChange('-5') -> '5'
 *  onChange('') -> ''
 */
export function makeNonNegativeIntOnChange<T extends Record<string, any>>(
  field: keyof T,
  setForm: React.Dispatch<React.SetStateAction<T>>
) {
  return (v: string) => {
    setForm((s) => ({
      ...s,
      [field]: sanitizeUnsignedInt(v),
    }));
  };
}

/**
 * Validate final non-negative integer string (no empty).
 * Accepts "0", "123", but not "", "-1", "3.14", "abc".
 */
export function isValidUnsignedInt(s: string): boolean {
  return /^\d+$/.test(s);
}

/* =========================================================================
   Scientific numbers
   ========================================================================= */

/**
 * Sanitize to a scientific-number-in-progress string (signed float with optional exponent).
 * Keeps digits, '.', 'e'/'E', '+'/'-' (for sign and exponent). Allows transient states.
 */
export function sanitizeScientific(input: string): string {
  // allow digits, period, e/E, plus/minus
  return input.replace(/[^0-9eE+.\-]/g, '');
}

/**
 * Create an onChange handler for a scientific number field stored as string.
 * The handler will sanitize the input to allow only valid characters for a scientific number.
 */
export function makeScientificOnChange<T extends Record<string, any>>(
  field: keyof T,
  setForm: React.Dispatch<React.SetStateAction<T>>
) {
  return (v: string) => {
    setForm((s) => ({
      ...s,
      [field]: sanitizeScientific(v),
    }));
  };
}

/**
 * Validate final scientific number string (signed float with optional exponent).
 * Accepts formats like "5", "-7", "3.14", ".5", "5.", "5e1", "6E-2", "-.7e+10".
 */
export function isValidScientific(s: string): boolean {
  // signed float with optional exponent
  //  - matches "5", "-7", "3.14", ".5", "5.", "5e1", "6E-2", "-.7e+10"
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s);
}

/* =========================================================================
   Float numbers (non-scientific)
   ========================================================================= */

/** Sanitize to a signed float-in-progress string.
 * Allows '-', '.', '-.', digits, and a single '.' anywhere after the optional sign.
 * Examples: '' -> '', '-' -> '-', '.' -> '.', '-.' -> '-.', '12..3' -> '12.3', '1-2' -> '12'
 */
export function sanitizeSignedFloat(input: string): string {
  if (!input) return '';
  // 1) Keep digits, dot, and minus
  let raw = input.replace(/[^0-9.\-]/g, '');

  // 2) Keep at most one leading '-'
  const firstDash = raw.indexOf('-');
  if (firstDash > 0) {
    // dash mid-string: drop it
    raw = raw.replace(/-/g, '');
  } else if (firstDash === 0) {
    // keep the leading dash, remove any other
    raw = '-' + raw.slice(1).replace(/-/g, '');
  }

  // 3) Keep at most one '.'
  const firstDot = raw.indexOf('.');
  if (firstDot !== -1) {
    const head = raw.slice(0, firstDot + 1);
    const tail = raw.slice(firstDot + 1).replace(/\./g, '');
    raw = head + tail;
  }

  return raw;
}

/**
 * Create an onChange handler for a signed-float field stored as string in state.
 * The handler will sanitize the input to allow only digits, an optional leading '-', and at most one '.'.
 * This ensures the value is always a valid signed float string (or empty for in-progress).
 * Examples:
 *  onChange('3.14') -> '3.14'
 *  onChange('-0.5') -> '-0.5'
 *  onChange('abc') -> ''
 *  onChange('1-2') -> '12'
 *  onChange('3..1') -> '3.1'
 *  onChange('--4') -> '-4'
 *  onChange('') -> ''
 */
export function makeSignedFloatOnChange<T extends Record<string, any>>(
  field: keyof T,
  setForm: React.Dispatch<React.SetStateAction<T>>
) {
  return (v: string) => {
    setForm((s) => ({
      ...s,
      [field]: sanitizeSignedFloat(v),
    }));
  };
}

/**
 * Validate a final signed float string (no empty or transient states).
 * Accepts: '-1', '0', '3.14', '-.5' (normalize check), '.5'
 * Treats '.5' and '-.5' as valid floats.
 */
export function isValidSignedFloat(s: string): boolean {
  // Accepts: '-1', '0', '3.14', '-.5' (normalize check), '.5'
  // Treat '.5' and '-.5' as valid floats.
  if (!s) return false;
  // Normalize leading '.' to '0.' and '-.' to '-0.' for test
  const normalized = s.startsWith('-.') ? s.replace('-.', '-0.') : s.startsWith('.') ? `0${s}` : s;
  return /^-?\d+(\.\d+)?$/.test(normalized);
}

/** 
 * Parse a string float safely. Returns NaN if invalid.
 * Accepts the same formats as isValidSignedFloat, including leading '.' or '-.'.
 * Normalizes leading '.' to '0.' and '-.' to '-0.' before parsing.
 */
export function parseSignedFloat(s: string): number {
  if (!isValidSignedFloat(s)) return NaN;
  const normalized = s.startsWith('-.') ? s.replace('-.', '-0.') : s.startsWith('.') ? `0${s}` : s;
  return Number(normalized);
}

/* =========================================================================
   Object IDs
   ========================================================================= */

/**
 * Sanitize to an ID-in-progress string with the given prefix (uppercase letters, digits, underscores).
 * Ensures the result starts with the prefix (case-insensitive) and removes invalid characters.
 * Examples:
 *  sanitizeID("poisonType_123", "POISONTYPE_") -> "POISONTYPE_123"
 *  sanitizeID("DISEASE-ABC", "DISEASE_") -> "DISEASE_ABC"
 *  sanitizeID("climate", "CLIMATE_") -> "CLIMATE_"
 *  sanitizeID("POISONTYPE-123", "POISONTYPE_") -> "POISONTYPE_123" (invalid '-' removed)
 *  sanitizeID("INVALID_123", "POISONTYPE_") -> "POISONTYPE_INVALID_123" (prefix added)
 */
export function sanitizeID(input: string, prefix: string): string {
  const upperPrefix = prefix.toUpperCase();
  let raw = input.toUpperCase();
  // Remove invalid characters (keep letters, digits, underscores)
  raw = raw.replace(/[^A-Z0-9_]/g, '');
  // Ensure it starts with the prefix
  if (!raw.startsWith(upperPrefix)) {
    raw = upperPrefix + raw.replace(new RegExp('^' + upperPrefix), '');
  }
  return raw;
}

/**
 * Create an onChange handler for an ID field stored as string.
 * The handler will sanitize the input to ensure it starts with the prefix and only contains valid characters.
 */
export function makeIDOnChange<T extends Record<string, any>>(
  field: keyof T,
  setForm: React.Dispatch<React.SetStateAction<T>>,
  prefix: string
) {
  return (v: string) => {
    setForm((s) => ({
      ...s,
      [field]: sanitizeID(v, prefix),
    }));
  };
}

/**
 * Returns true when val is a valid ID with the given prefix.
 * A valid ID starts with the prefix (case-insensitive) and is followed by at least one additional character.
 * The entire ID can only contain uppercase letters, digits, and underscores.
 * Examples:
 *  isValidID("POISONTYPE_123", "POISONTYPE_") -> true
 *  isValidID("DISEASE_ABC", "DISEASE_") -> true
 *  isValidID("CLIMATE_", "CLIMATE_") -> false (no additional characters)
 *  isValidID("POISONTYPE-123", "POISONTYPE_") -> false (invalid character '-')
 *  isValidID("INVALID_123", "POISONTYPE_") -> false (wrong prefix)
 */
export function isValidID(val: string, prefix: string): boolean {
  return val.startsWith(prefix.toUpperCase()) && /^[A-Z0-9_]+$/.test(val) && val.length > prefix.length;
}

/* =========================================================================
   Other specific formats
   ========================================================================= */

/**
 * Returns true when s is a valid ISBN-10 or ISBN-13 (digits, optional dashes/spaces, optional X for ISBN-10).
 */
export function isValidISBN(s: string): boolean {
  return /^(?:\d{9}[\dXx]|\d{13})$/.test(s.replace(/[-\s]/g, ''));
}


/* =========================================================================
   Utility functions for form validation and error messages
   ========================================================================= */

/**
 * Returns an error message if no items are selected, otherwise undefined.
 * Usage: requireAtLeastOne(values, "precipitation")
 */
export function requireAtLeastOne<T extends string>(
  values: readonly T[] | undefined | null,
  labelSingular: string
): string | undefined {
  if (!values || values.length === 0) {
    // Keep the message short and consistent; customize per field in caller if needed.
    return `Select at least one ${labelSingular}`;
  }
  return undefined;
}

/**
 * Returns undefined when valid, else the provided message.
 * Handy when you compose multiple rules.
 */
export function whenInvalid(
  condition: boolean,
  message: string
): string | undefined {
  return condition ? message : undefined;
}

/**
 * Clamp a numeric value to an optional [min,max] range (if provided).
 * If min or max is not a finite number, that bound is ignored.
 * Usage: const clamped = clamp(inputValue, { min: 0, max: 100 });
 */
export function clamp(n: number, opts?: { min?: number; max?: number }): number {
  const { min, max } = opts ?? {};
  let v = n;
  if (min != null && Number.isFinite(min)) v = Math.max(v, min);
  if (max != null && Number.isFinite(max)) v = Math.min(v, max);
  return v;
}

/**
 * Format a numeric (or numeric-string) to a fixed precision string (no trailing zeros by default).
 * Examples:
 *  toFixedString(3.14159) -> "3.14"
 *  toFixedString(3.100, 2) -> "3.1"
 *  toFixedString(3, 2) -> "3"
 *  toFixedString("2.71828", 3) -> "2.718"
 *  toFixedString("abc", 2) -> "abc" (invalid number returns original string)
 *  toFixedString(1.005, 2) -> "1.01" (rounding works correctly)
 *  toFixedString(1.000, 2, false) -> "1.00" (trailing zeros kept when trim=false)
 */
export function toFixedString(value: number | string, decimals = 2, trim = true): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  const s = n.toFixed(decimals);
  return trim ? s.replace(/(\.\d*?[1-9])0+$/,'$1').replace(/\.0+$/,'') : s;
}
