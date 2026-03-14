
import { lazy, type LazyExoticComponent, type ComponentType } from 'react';

const BooksView = lazy(() => import('./books/BooksView'));
const PoisonsView = lazy(() => import('./poisons/PoisonsView'));
const ArmourtypesView = lazy(() => import('./armourtypes/ArmourtypesView'));
const PrefixesView = lazy(() => import('./prefixes/PrefixesView'));

export interface EndpointDef {
  id: string;
  label: string;
  path: `/${string}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: LazyExoticComponent<ComponentType>
}


/**
 * Each endpoint entry:
 * - id: unique key
 * - label: nav label
 * - path: route path (e.g., '/books')
 * - Component: lazy-loaded UI component for this endpoint
 */
export const endpoints: EndpointDef[] = [
  { id: 'books', label: 'Books', path: '/books', Component: BooksView },
  { id: 'poisons', label: 'Poisons', path: '/poisons', Component: PoisonsView },
  { id: 'armourtypes', label: 'Armour Types', path: '/armourtypes', Component: ArmourtypesView },
  { id: 'prefixes', label: 'Prefixes', path: '/prefixes', Component: PrefixesView },
];


// Export a default path with a safe fallback
export const DEFAULT_PATH: `/${string}` = endpoints[0]?.path ?? '/books';