// src/endpoints/books/api.js
import { fetchJson, sendJson } from '../../api/client';

const BASE = '/rmce/objects/book'; // trailing slash added in functions where needed

export async function fetchBooks() {
  const data = await fetchJson(`${BASE}`);
  if (!data || !Array.isArray(data.books)) {
    throw new Error('Unexpected response: expected { books: [...] }');
  }
  return data.books;
}

/**
 * Create or update a single book.
 * By default, POSTs to the collection path '/rmce/objects/book/' with a single JSON object payload:
 *   {"id":"BOOK_NEW_BOOK","code":"1560","name":"New Book","abbreviation":"NwBk*","isbn":"1-12345-123-4"}
 *
 * If your backend expects PUT /rmce/objects/book/{id}, set { useResourceIdPath: true, method: 'PUT' }.
 */
export async function upsertBook(book, opts = {}) {
  const { method = 'POST', useResourceIdPath = false } = opts;
  const url = useResourceIdPath && book?.id
    ? `${BASE}/${encodeURIComponent(book.id)}`
    : `${BASE}/`; // collection path with trailing slash
  return sendJson(url, method, book);
}