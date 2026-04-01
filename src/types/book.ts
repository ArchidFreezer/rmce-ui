/**
 * Book data
 * Note: The API's book data is pretty straightforward, with a simple structure that includes an ID, code, name, abbreviation, and ISBN. I've defined the types accordingly, 
 * but we may want to add some additional fields or relationships in the future if the API expands or if we need to link books to other entities in the UI (e.g., characters, poisons, etc.).
 */
export interface Book {
  id: string;
  code: string;
  name: string;
  abbreviation: string;
  isbn: string;
}
export interface BooksPayload {
  books: Book[];
}