import { fetchJson } from './client';
import type { PrefixesPayload } from '../types/prefix';

// GET /rmce/objects/prefixes → { prefixes: string[] }
export async function fetchPrefixes(): Promise<string[]> {
  const data = await fetchJson<PrefixesPayload>('/rmce/objects/prefixes');
  if (!data || !Array.isArray(data.prefixes)) {
    throw new Error('Unexpected response: expected { prefixes: string[] }');
  }
  return data.prefixes;
}