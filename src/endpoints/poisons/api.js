// src/endpoints/poisons/api.js
import { fetchJson } from '../../api/client';

export async function fetchPoisons() {
  const data = await fetchJson('/rmce/objects/poison');
  if (!data || !Array.isArray(data.poisons)) {
    throw new Error('Unexpected response: expected { poisons: [...] }');
  }
  return data.poisons;
}