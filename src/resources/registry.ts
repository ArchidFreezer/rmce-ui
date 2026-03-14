import { lazy, type LazyExoticComponent, type ComponentType } from 'react';

// Lazy screens for known resources
const BooksView = lazy(() => import('../endpoints/books/BooksView'));
const PoisonsView = lazy(() => import('../endpoints/poisons/PoisonsView'));
const ArmourtypesView = lazy(() => import('../endpoints/armourtypes/ArmourtypesView'));

// A Resource definition the runtime can route/render
export interface ResourceDef {
  /** API prefix, e.g., "book" | "poison" | "armourtype" */
  prefix: string;
  /** Sidebar label */
  label: string;
  /** Route path to mount, e.g. "/books" */
  path: `/${string}`;
  /** Lazy view component */
  Component: LazyExoticComponent<ComponentType>;
}

/** Known resources with their route metadata */
const known: Record<string, ResourceDef> = {
  book: {
    prefix: 'book',
    label: 'Books',
    path: '/books',
    Component: BooksView,
  },
  poison: {
    prefix: 'poison',
    label: 'Poisons',
    path: '/poisons',
    Component: PoisonsView,
  },
  armourtype: {
    prefix: 'armourtype',
    label: 'Armour Types',
    path: '/armourtypes',
    Component: ArmourtypesView,
  },
};

/**
 * Build ResourceDefs from API prefixes.
 * Unknown prefixes are ignored (or you could route them to a generic viewer).
 */
export function buildResources(prefixes: string[]): ResourceDef[] {
  return prefixes
    .map((p) => known[p])
    .filter((r): r is ResourceDef => Boolean(r));
}

/** Optional: static fallback if API is unreachable */
export const FALLBACK_RESOURCES: ResourceDef[] = [
  known.book,
  known.poison,
  known.armourtype,
].filter(Boolean) as ResourceDef[];