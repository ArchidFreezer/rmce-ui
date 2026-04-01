import { fetchJson, sendJson } from './client';

import type { 
  Book, BooksPayload,
 } from '../types';

const BASE = '/rmce/objects/book';

export async function fetchBooks(): Promise<Book[]> {
  const data = await fetchJson<BooksPayload>(`${BASE}`);
  if (!data || !Array.isArray(data.books)) {
    throw new Error('Unexpected response: expected { books: [...] }');
  }
  return data.books;
}

/** Create or update a single book. Default: POST to collection with trailing slash. */
export async function upsertBook(
  book: Book,
  opts: { method?: 'POST' | 'PUT' } = {}
): Promise<unknown> {
  const { method = 'POST' } = opts;
  const url = BASE;
  return sendJson(url, method, book);
}

/** DELETE /rmce/objects/book/{id} */
export async function deleteBook(id: string): Promise<unknown> {
  if (!id) throw new Error('deleteBook: id is required');
  const url = `${BASE}/${encodeURIComponent(id)}`;
  return fetchJson(url, { method: 'DELETE' });
}