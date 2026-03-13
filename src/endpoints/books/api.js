// src/endpoints/books/api.js
import { fetchJson } from '../../api/client';

export async function fetchBooks() {
  const data = await fetchJson('/rmce/objects/book');
  if (!data || !Array.isArray(data.books)) {
    throw new Error('Unexpected response: expected { books: [...] }');
  }
  return data.books;
}