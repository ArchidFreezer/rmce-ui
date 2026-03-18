// Reusable helpers for forms with exactOptionalPropertyTypes = true

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


/** Validate final signed integer string (no empty, no lone '-'). */
export function isValidSignedInt(s: string): boolean {
  return /^-?\d+$/.test(s);
}

/** Validate final non-negative integer string (no empty). */
export function isValidUnsignedInt(s: string): boolean {
  return /^\d+$/.test(s);
}

/** Validate final scientific number string (signed float with optional exponent). */
export function isValidScientific(s: string): boolean {
  // signed float with optional exponent
  //  - matches "5", "-7", "3.14", ".5", "5.", "5e1", "6E-2", "-.7e+10"
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s);
}

/** Returns true when s is a valid ISBN-10 or ISBN-13 (digits, optional dashes/spaces, optional X for ISBN-10). */
export function isValidISBN(s: string): boolean {
  return /^(?:\d{9}[\dXx]|\d{13})$/.test(s.replace(/[-\s]/g, ''));
}

/** Returns true when val is a valid ID with the given prefix. */
export function isValidID(val: string, prefix: string): boolean {
  return val.startsWith(prefix.toUpperCase()) && /^[A-Z0-9_]+$/.test(val) && val.length > prefix.length;
}