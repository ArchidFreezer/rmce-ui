// integer-only sanitizer
export function sanitizeSignedInt (s: string) { return s.replace(/[^0-9+\-]/g, ''); }

// unsigned integer-only sanitizer
export function sanitizeUnsignedInt (s: string) { return s.replace(/[^\d]/g, ''); }