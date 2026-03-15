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