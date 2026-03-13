export async function fetchJson<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    headers: { Accept: 'application/json', ...(init.headers || {}) },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }

  // Safely parse JSON or return undefined for empty bodies (e.g., 204)
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function sendJson<T = unknown>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH',
  body: unknown,
  init: RequestInit = {}
): Promise<T> {
  return fetchJson<T>(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    body: JSON.stringify(body),
    ...init,
  });
}