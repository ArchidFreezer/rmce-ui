// src/api.js
export async function fetchBooksPayload() {
  const res = await fetch('/rmce/objects/book', {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }
  const data = await res.json();
  if (!data || !Array.isArray(data.books)) {
    throw new Error('Unexpected response: expected { books: [...] }');
  }
  return data; // { books: [...] }
}

export async function fetchPoisonsPayload() {
  const res = await fetch('/rmce/objects/poison', {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }
  const data = await res.json();
  if (!data || !Array.isArray(data.poisons)) {
    throw new Error('Unexpected response: expected { poisons: [...] }');
  }
  return data; // { poisons: [...] }
}