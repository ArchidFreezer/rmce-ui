// src/endpoints/registry.js
import { lazy } from 'react';

const BooksView = lazy(() => import('./books/BooksView.jsx'));
const PoisonsView = lazy(() => import('./poisons/PoisonsView.jsx'));

/**
 * Each endpoint entry:
 * - id: unique key
 * - label: nav label
 * - path: route path (e.g., '/books')
 * - Component: lazy-loaded UI component for this endpoint
 */
export const endpoints = [
  { id: 'books', label: 'Books', path: '/books', Component: BooksView },
  { id: 'poisons', label: 'Poisons', path: '/poisons', Component: PoisonsView },
];