import { lazy, type LazyExoticComponent, type ComponentType } from 'react';

const ArmourTypeView = lazy(() => import('../endpoints/armourtype/ArmourTypeView'));
const BookView = lazy(() => import('../endpoints/book/BookView'));
const ClimateView = lazy(() => import('../endpoints/climate/ClimateView'));
const CreaturePaceView = lazy(() => import('../endpoints/creaturepace/CreaturePaceView'));
const DiseaseView = lazy(() => import('../endpoints/disease/DiseaseView'));
const DiseaseTypeView = lazy(() => import('../endpoints/diseasetype/DiseaseTypeView'));
const LanguageView = lazy(() => import('../endpoints/language/LanguageView'));
const LanguageCategoryView = lazy(() => import('../endpoints/languagecategory/LanguageCategoryView'));
const PoisonView = lazy(() => import('../endpoints/poison/PoisonView'));
const PoisonTypeView = lazy(() => import('../endpoints/poisontype/PoisonTypeView'));
const SkillCategoryView = lazy(() => import('../endpoints/skillcategory/SkillCategoryView'));
const SkillGroupView = lazy(() => import('../endpoints/skillgroup/SkillGroupView'));
const SkillProgressionTypeView = lazy(() => import('../endpoints/skillprogressiontype/SkillProgressionTypeView'));
const SpellListView = lazy(() => import('../endpoints/spelllist/SpellListView'));


export interface ResourceDef {
  prefix: string;
  label: string;
  path: `/${string}`;
  Component: LazyExoticComponent<ComponentType>;
}

/** Known resources with their routes/components */

const known: Record<string, ResourceDef> = {
  armourtype: { prefix: 'armourtype', label: 'Armour Types', path: '/armourtypes', Component: ArmourTypeView },
  book: { prefix: 'book', label: 'Books', path: '/books', Component: BookView },
  climate: { prefix: 'climate', label: 'Climates', path: '/climates', Component: ClimateView },
  creaturepace: { prefix: 'creaturepace', label: 'Creature Paces', path: '/creaturepaces', Component: CreaturePaceView },
  disease: { prefix: 'disease', label: 'Diseases', path: '/diseases', Component: DiseaseView },
  diseasetype: { prefix: 'diseasetype', label: 'Disease Types', path: '/diseasetypes', Component: DiseaseTypeView },
  language: { prefix: 'language', label: 'Languages', path: '/languages', Component: LanguageView },
  languagecategory: { prefix: 'languagecategory', label: 'Language Categories', path: '/languagecategories', Component: LanguageCategoryView },
  poison: { prefix: 'poison', label: 'Poisons', path: '/poisons', Component: PoisonView },
  poisontype: { prefix: 'poisontype', label: 'Poison Types', path: '/poisontypes', Component: PoisonTypeView },
  skillcategory: { prefix: 'skillcategory', label: 'Skill Categories', path: '/skillcategories', Component: SkillCategoryView },
  skillgroup: { prefix: 'skillgroup', label: 'Skill Groups', path: '/skillgroups', Component: SkillGroupView },
  skillprogressiontype: { prefix: 'skillprogressiontype', label: 'Skill Progression Types', path: '/skillprogressiontypes', Component: SkillProgressionTypeView },
  spelllist: { prefix: 'spelllist', label: 'Spell Lists', path: '/spelllists', Component: SpellListView },
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
  known.language,
  known.languagecategory,
  known.poison,
  known.poisontype,
  known.skillcategory,
  known.skillgroup,
  known.skillprogressiontype,
  known.spelllist,
].filter((r): r is ResourceDef => Boolean(r));