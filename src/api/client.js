// src/api/client.js
export async function fetchJson(path, init = {}) {
  // path can be relative like '/rmce/objects/book'
  const res = await fetch(path, {
    headers: { 'Accept': 'application/json', ...(init.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}