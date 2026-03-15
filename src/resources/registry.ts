import { lazy, type LazyExoticComponent, type ComponentType } from 'react';

const ArmourtypesView = lazy(() => import('../endpoints/armourtypes/ArmourtypesView'));
const BooksView = lazy(() => import('../endpoints/books/BooksView'));
const ClimateView = lazy(() => import('../endpoints/climates/ClimateView'));
const PoisonsView = lazy(() => import('../endpoints/poisons/PoisonsView'));


export interface ResourceDef {
  prefix: string;
  label: string;
  path: `/${string}`;
  Component: LazyExoticComponent<ComponentType>;
}

/** Known resources with their routes/components */

const known: Record<string, ResourceDef> = {
  armourtype:  { prefix: 'armourtype',  label: 'Armour Types', path: '/armourtypes', Component: ArmourtypesView },
  book:        { prefix: 'book',        label: 'Books',        path: '/books',       Component: BooksView },
  climate:     { prefix: 'climate',     label: 'Climates',     path: '/climates',    Component: ClimateView },
  poison:      { prefix: 'poison',      label: 'Poisons',      path: '/poisons',     Component: PoisonsView },
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
  known.armourtype,
  known.book,
  known.climate,
  known.poison,
].filter((r): r is ResourceDef => Boolean(r));