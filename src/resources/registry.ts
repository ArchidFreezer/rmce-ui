import { lazy, type LazyExoticComponent, type ComponentType } from 'react';

const AnimalView = lazy(() => import('../endpoints/animal/AnimalView'));
const ArmourTypeView = lazy(() => import('../endpoints/armourtype/ArmourTypeView'));
const AttackTableView = lazy(() => import('../endpoints/attacktable/AttackTableView'));
const BookView = lazy(() => import('../endpoints/book/BookView'));
const ClimateView = lazy(() => import('../endpoints/climate/ClimateView'));
const CreaturePaceView = lazy(() => import('../endpoints/creaturepace/CreaturePaceView'));
const CultureView = lazy(() => import('../endpoints/culture/CultureView'));
const CultureTypeView = lazy(() => import('../endpoints/culturetype/CultureTypeView'));
const DiseaseView = lazy(() => import('../endpoints/disease/DiseaseView'));
const DiseaseTypeView = lazy(() => import('../endpoints/diseasetype/DiseaseTypeView'));
const LanguageView = lazy(() => import('../endpoints/language/LanguageView'));
const LanguageCategoryView = lazy(() => import('../endpoints/languagecategory/LanguageCategoryView'));
const PoisonView = lazy(() => import('../endpoints/poison/PoisonView'));
const PoisonTypeView = lazy(() => import('../endpoints/poisontype/PoisonTypeView'));
const ProfessionView = lazy(() => import('../endpoints/profession/ProfessionView'));
const RaceView = lazy(() => import('../endpoints/race/RaceView'));
const SkillView = lazy(() => import('../endpoints/skill/SkillView'));
const SkillCategoryView = lazy(() => import('../endpoints/skillcategory/SkillCategoryView'));
const SkillGroupView = lazy(() => import('../endpoints/skillgroup/SkillGroupView'));
const SkillProgressionTypeView = lazy(() => import('../endpoints/skillprogressiontype/SkillProgressionTypeView'));
const SpecialAttackTableView = lazy(() => import('../endpoints/specialattacktable/SpecialAttackTableView'));
const SpellListView = lazy(() => import('../endpoints/spelllist/SpellListView'));
const TrainingPackageView = lazy(() => import('../endpoints/trainingpackage/TrainingPackageView'));
const TreasureCodeView = lazy(() => import('../endpoints/treasurecode/TreasureCodeView'));
const WeaponTypeView = lazy(() => import('../endpoints/weapontype/WeaponTypeVIew'));


export interface ResourceDef {
  prefix: string;
  label: string;
  path: `/${string}`;
  Component: LazyExoticComponent<ComponentType>;
}
/** Known resources with their routes/components */

const known: Record<string, ResourceDef> = {
  animal: { prefix: 'animal', label: 'Animals', path: '/animals', Component: AnimalView },
  armourtype: { prefix: 'armourtype', label: 'Armour Types', path: '/armourtypes', Component: ArmourTypeView },
  attacktable: { prefix: 'attacktable', label: 'Attack Tables', path: '/attacktables', Component: AttackTableView },
  book: { prefix: 'book', label: 'Books', path: '/books', Component: BookView },
  climate: { prefix: 'climate', label: 'Climates', path: '/climates', Component: ClimateView },
  creaturepace: { prefix: 'creaturepace', label: 'Creature Paces', path: '/creaturepaces', Component: CreaturePaceView },
  culture: { prefix: 'culture', label: 'Cultures', path: '/cultures', Component: CultureView },
  culturetype: { prefix: 'culturetype', label: 'Culture Types', path: '/culturetypes', Component: CultureTypeView },
  disease: { prefix: 'disease', label: 'Diseases', path: '/diseases', Component: DiseaseView },
  diseasetype: { prefix: 'diseasetype', label: 'Disease Types', path: '/diseasetypes', Component: DiseaseTypeView },
  language: { prefix: 'language', label: 'Languages', path: '/languages', Component: LanguageView },
  languagecategory: { prefix: 'languagecategory', label: 'Language Categories', path: '/languagecategories', Component: LanguageCategoryView },
  poison: { prefix: 'poison', label: 'Poisons', path: '/poisons', Component: PoisonView },
  poisontype: { prefix: 'poisontype', label: 'Poison Types', path: '/poisontypes', Component: PoisonTypeView },
  profession: { prefix: 'profession', label: 'Professions', path: '/professions', Component: ProfessionView },
  race: { prefix: 'race', label: 'Races', path: '/races', Component: RaceView },
  skill: { prefix: 'skill', label: 'Skills', path: '/skills', Component: SkillView },
  skillcategory: { prefix: 'skillcategory', label: 'Skill Categories', path: '/skillcategories', Component: SkillCategoryView },
  skillgroup: { prefix: 'skillgroup', label: 'Skill Groups', path: '/skillgroups', Component: SkillGroupView },
  skillprogressiontype: { prefix: 'skillprogressiontype', label: 'Skill Progression Types', path: '/skillprogressiontypes', Component: SkillProgressionTypeView },
  specialattacktable: { prefix: 'specialattacktable', label: 'Special Attack Tables', path: '/specialattacktables', Component: SpecialAttackTableView },
  spelllist: { prefix: 'spelllist', label: 'Spell Lists', path: '/spelllists', Component: SpellListView },
  trainingpackage: { prefix: 'trainingpackage', label: 'Training Packages', path: '/trainingpackages', Component: TrainingPackageView },
  treasurecode: { prefix: 'treasurecode', label: 'Treasure Codes', path: '/treasurecodes', Component:TreasureCodeView },
  weapontype: { prefix: 'weapontype', label: 'Weapon Types', path: '/weapontypes', Component: WeaponTypeView },
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
  known.animal,
  known.armourtype,
  known.attacktable,
  known.book,
  known.climate,
  known.creaturepace,
  known.culturetype,
  known.disease,
  known.diseasetype,
  known.language,
  known.languagecategory,
  known.poison,
  known.poisontype,
  known.profession,
  known.race,
  known.skill,
  known.skillcategory,
  known.skillgroup,
  known.skillprogressiontype,
  known.specialattacktable,
  known.spelllist,
  known.trainingpackage,
  known.treasurecode,
  known.weapontype,
].filter((r): r is ResourceDef => Boolean(r));