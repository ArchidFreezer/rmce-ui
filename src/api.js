export async function fetchBooksPayload() {
  const res = await fetch('/rmce/objects/book', {
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }

  const data = await res.json();

  // Validate the expected shape: { books: [...] }
  if (!data || !Array.isArray(data.books)) {
    throw new Error('Unexpected response: expected an object with a "books" array.');
  }

  return data; // { books: [...] }
}