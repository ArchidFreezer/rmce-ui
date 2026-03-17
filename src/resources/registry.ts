import { lazy, type LazyExoticComponent, type ComponentType } from 'react';

const ArmourTypesView = lazy(() => import('../endpoints/armourtype/ArmourTypesView'));
const BooksView = lazy(() => import('../endpoints/book/BooksView'));
const ClimateView = lazy(() => import('../endpoints/climate/ClimateView'));
const CreaturePaceView = lazy(() => import('../endpoints/creaturepace/CreaturePaceView'));
const DiseasesView = lazy(() => import('../endpoints/diseases/DiseasesView'));
const DiseasetypesView = lazy(() => import('../endpoints/diseasetypes/DiseasetypesView'));
const PoisonsView = lazy(() => import('../endpoints/poisons/PoisonsView'));
const PoisontypesView = lazy(() => import('../endpoints/poisontypes/PoisontypesView'));


export interface ResourceDef {
  prefix: string;
  label: string;
  path: `/${string}`;
  Component: LazyExoticComponent<ComponentType>;
}

/** Known resources with their routes/components */

const known: Record<string, ResourceDef> = {
  armourtype: { prefix: 'armourtype', label: 'Armour Types', path: '/armourtypes', Component: ArmourTypesView },
  book: { prefix: 'book', label: 'Books', path: '/books', Component: BooksView },
  climate: { prefix: 'climate', label: 'Climates', path: '/climates', Component: ClimateView },
  creaturepace: { prefix: 'creaturepace', label: 'Creature Paces', path: '/creaturepaces', Component: CreaturePaceView },
  disease: { prefix: 'disease', label: 'Diseases', path: '/diseases', Component: DiseasesView },
  diseasetype: { prefix: 'diseasetype', label: 'Disease Types', path: '/diseasetypes', Component: DiseasetypesView },
  poison: { prefix: 'poison', label: 'Poisons', path: '/poisons', Component: PoisonsView },
  poisontype: { prefix: 'poisontype', label: 'Poison Types', path: '/poisontypes', Component: PoisontypesView },
}


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
  known.creaturepace,
  known.disease,
  known.diseasetype,
  known.poison,
  known.poisontype,
].filter((r): r is ResourceDef => Boolean(r));