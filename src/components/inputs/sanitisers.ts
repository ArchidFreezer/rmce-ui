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

/** Create an onChange handler for a signed-integer field stored as string in state. */
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

/* =========================================================================
   Unsigned integers
   ========================================================================= */

/** Sanitize to a non-negative integer-in-progress string (digits only). */
export function sanitizeUnsignedInt(input: string): string {
  return input.replace(/[^\d]/g, '');
}

/** Create an onChange handler for a non-negative integer field stored as string. */
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


/* =========================================================================
   Scientific numbers
   ========================================================================= */

/** Sanitize to a scientific-number-in-progress string (signed float with optional exponent).
 * Keeps digits, '.', 'e'/'E', '+'/'-' (for sign and exponent). Allows transient states.
 */
export function sanitizeScientific(input: string): string {
  // allow digits, period, e/E, plus/minus
  return input.replace(/[^0-9eE+.\-]/g, '');
}

/** Create an onChange handler for a scientific number field stored as string. */
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

/* =========================================================================
   Other specific formats
   ========================================================================= */

/** Sanitize to an ID-in-progress string with the given prefix (uppercase letters, digits, underscores). */
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

/** Create an onChange handler for an ID field stored as string. */
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