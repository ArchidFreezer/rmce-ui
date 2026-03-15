import { lazy, type LazyExoticComponent, type ComponentType } from 'react';

const BooksView = lazy(() => import('../endpoints/books/BooksView'));
const PoisonsView = lazy(() => import('../endpoints/poisons/PoisonsView'));
const ArmourtypesView = lazy(() => import('../endpoints/armourtypes/ArmourtypesView'));

export interface ResourceDef {
  prefix: string;
  label: string;
  path: `/${string}`;
  Component: LazyExoticComponent<ComponentType>;
}

/** Known resources with their routes/components */
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

/** Split known vs unknown prefixes (for Generic Viewer, etc.) */
export function splitResources(prefixes: string[]): { known: ResourceDef[]; unknown: string[] } {
  const knownDefs: ResourceDef[] = [];
  const unknown: string[] = [];
  for (const p of prefixes) {
    const def = known[p];
    if (def) knownDefs.push(def);
    else unknown.push(p);
  }
  return { known: knownDefs, unknown };
}

/** Optional: static fallback if /rmce/prefixes fails */
export const FALLBACK_RESOURCES: ResourceDef[] = [
  known.book,
  known.poison,
  known.armourtype,
].filter((r): r is ResourceDef => Boolean(r));