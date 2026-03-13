// src/endpoints/books/api.js
import { fetchJson, sendJson } from '../../api/client';

const BASE = '/rmce/objects/book';

export async function fetchBooks() {
  const data = await fetchJson(`${BASE}`);
  if (!data || !Array.isArray(data.books)) {
    throw new Error('Unexpected response: expected { books: [...] }');
  }
  return data.books;
}

export async function upsertBook(book, opts = {}) {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && book?.id
    ? `${BASE}/${encodeURIComponent(book.id)}`
    : `${BASE}/`;
  return sendJson(url, method, book);
}

/**
 * DELETE /rmce/objects/book/{id}
 */
export async function deleteBook(id) {
  if (!id) throw new Error('deleteBook: id is required');
  const url = `${BASE}/${encodeURIComponent(id)}`;
  // Use fetchJson so non-2xx throws; tolerate empty body
  return fetchJson(url, { method: 'DELETE' });
}