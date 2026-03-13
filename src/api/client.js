// src/api/client.js
export async function fetchJson(path, init = {}) {
  const res = await fetch(path, {
    headers: { 'Accept': 'application/json', ...(init.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json().catch(() => ({})); // in case server returns no body
}

export async function sendJson(path, method, body, init = {}) {
  return fetchJson(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    body: JSON.stringify(body),
    ...init,
  });
}