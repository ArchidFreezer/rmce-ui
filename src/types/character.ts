import type { Named, PersistentValue, SkillValue, SkillDevelopmentTypeValue } from './base';
import type { Realm, Stat } from './enum';
import type { LanguageAbility } from './language';

export interface SkillSubcategory {
  id: string;
  subcategory?: string | undefined;
}

export interface CharacterRealmProgression {
  id: Realm;
  value: string;
}

export interface CharacterStatValue {
  stat: Stat;
  temporary: number;
  potential: number;
  racialBonus: number;
}

export interface CharacterCategoryCost {
  category: string; // SkillCategory.id
  cost: string;     // 0 to 3 colon-separated positive numbers
}

export interface CharacterCategorySpellLists {
  category: string; // SkillCategory.id
  spellLists: string[]; // SpellList.id[]
}

export interface CharacterBuilder extends Named {
  built: boolean;
  race: string; // Race.id
  culture: string; // Culture.id
  cultureType: string;  // CultureType.id
  profession: string; // Profession.id
  male: boolean;

  autoHeight: boolean;
  enteredHeight: number | null;
  autoBuildModifier: boolean;
  enteredBuildModifier: number | null;


  magicalRealms: Realm[];
  numHobbySkillRanks: number;
  numAdolescentLanguageRanks: number;
  numAdolescentSpellListRanks: number;
  developmentPoints: number;

  categorySpellLists: CharacterCategorySpellLists[];
  trainingPackageCosts: PersistentValue[]; // TrainingPackage.id and cost

  /* Initial Choices */
  // Race
  raceCategoryEverymanChoices: SkillSubcategory[];
  // Culture Type
  cultureTypeCategorySkillRanks: SkillValue[];
  // Culture
  hobbySkillRankChoices: SkillValue[];
  hobbyCategoryRankChoices: PersistentValue[];
  // Profession
  profSkillDevelopmentTypeChoices: SkillDevelopmentTypeValue[];
  profCategoryDevelopmentTypeChoices: SkillDevelopmentTypeValue[];
  profGroupDevelopmentTypeChoices: SkillDevelopmentTypeValue[];
  baseSpellListChoices: string[]; // SpellList.id[]
  weaponCategoryCostChoices: CharacterCategoryCost[];
  // Realms

  /* Initial Stats */
  initialStats: CharacterStatValue[];

  /* Physique */
  height: number;
  weight: number;
  lifespan: number;
  buildDescription: string;

  /* Hobby/Adolescent choices */
  hobbySkillRanks: SkillValue[];
  hobbyCategoryRanks: PersistentValue[];
  adolescentSpellListChoice: string | null; // SpellList.id
  adolescentLanguageChoices: LanguageAbility[];

  /* Background choices */
  backgroundStats: CharacterStatValue[];
  backgroundExtraGold: number;
  backgroundLanguageChoices: LanguageAbility[];
  backgroundSkillSpecialBonuses: SkillValue[];
  backgroundCategorySpecialBonuses: PersistentValue[];
  backgroundItems?: string[] | undefined; // Item.id[]

  /* Apprenticeship choices */
  apprenticeshipTrainingPackages: string[]; // TrainingPackage.id[]
  apprenticeshipStatGains: Stat[];

  /* Aggregated State */
  totalGold: number;
  languageAbilities: LanguageAbility[];
  realmProgressions: CharacterRealmProgression[];
  stats: CharacterStatValue[];

  skillRanks: SkillValue[];
  skillProfessionalBonuses: SkillValue[];
  skillSpecialBonuses: SkillValue[];
  skillDevelopmentTypes: SkillDevelopmentTypeValue[];

  categoryRanks: PersistentValue[];
  categoryProfessionalBonuses: PersistentValue[];
  categorySpecialBonuses: PersistentValue[];
  categoryCosts: CharacterCategoryCost[];

  groupProfessionalBonuses: PersistentValue[];
  groupSpecialBonuses: PersistentValue[];

  spellListRanks: PersistentValue[];

  items?: string[] | undefined; // Item.id[]
}

export function createEmptyCharacterBuilder(): CharacterBuilder {
  return {
    id: '',
    name: '',
    built: false,
    race: '',
    culture: '',
    cultureType: '',
    profession: '',

    male: true,
    autoHeight: true,
    enteredHeight: null,
    autoBuildModifier: true,
    enteredBuildModifier: null,

    magicalRealms: [],
    numHobbySkillRanks: 0,
    numAdolescentLanguageRanks: 0,
    numAdolescentSpellListRanks: 0,
    developmentPoints: 0,

    categorySpellLists: [],
    trainingPackageCosts: [],

    /* Initial Choices */
    // Race
    raceCategoryEverymanChoices: [],
    // Culture Type
    cultureTypeCategorySkillRanks: [],
    // Culture
    hobbySkillRankChoices: [],
    hobbyCategoryRankChoices: [],
    // Profession
    profSkillDevelopmentTypeChoices: [],
    profCategoryDevelopmentTypeChoices: [],
    profGroupDevelopmentTypeChoices: [],
    baseSpellListChoices: [],
    weaponCategoryCostChoices: [],
    // Realms

    /* Initial Stats */
    initialStats: [],

    /* Physique */
    height: 0,
    weight: 0,
    lifespan: 0,
    buildDescription: '',

    /* Hobby/Adolescent choices */
    hobbySkillRanks: [],
    hobbyCategoryRanks: [],
    adolescentSpellListChoice: null, // SpellList.id
    adolescentLanguageChoices: [],

    /* Background choices */
    backgroundStats: [],
    backgroundExtraGold: 0,
    backgroundLanguageChoices: [],
    backgroundSkillSpecialBonuses: [],
    backgroundCategorySpecialBonuses: [],
    backgroundItems: [],

    /* Apprenticeship choices */
    apprenticeshipTrainingPackages: [],
    apprenticeshipStatGains: [],

    /* Aggregated State */
    totalGold: 0,
    languageAbilities: [],
    realmProgressions: [],
    stats: [],

    skillRanks: [],
    skillProfessionalBonuses: [],
    skillSpecialBonuses: [],
    skillDevelopmentTypes: [],

    categoryRanks: [],
    categoryProfessionalBonuses: [],
    categorySpecialBonuses: [],
    categoryCosts: [],

    groupProfessionalBonuses: [],
    groupSpecialBonuses: [],

    spellListRanks: [],
    items: [],
  };
}
