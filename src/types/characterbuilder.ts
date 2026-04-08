import type { Named, PersistentValue, PersistentDevelopmentTypeValue, SkillValue, SkillDevelopmentTypeValue } from './base';
import type { Realm, Stat } from './enum';
import type { LanguageAbility } from './language';

export interface CharacterBuilderIdOptionalSubcategory {
  id: string;
  subcategory?: string | undefined;
}

export interface CharacterBuilderRealmProgression {
  id: Realm;
  value: string;
}

export interface CharacterBuilderStatValue {
  stat: Stat;
  temporary: number;
  potential: number;
  bonus: number;
}

export interface CharacterBuilderCategoryCost {
  category: string; // SkillCategory.id
  cost: string;     // 1 to 3 colon-separated positive numbers
}

export interface CharacterBuilder extends Named {
  built: boolean;
  race: string;
  culture: string;
  cultureType: string;
  profession: string;

  magicalRealms: Realm[];
  numHobbySkillRanks: number;
  numAdolescentLanguageRanks: number;
  numAdolescentSpellListRanks: number;
  developmentPoints: number;

  /* Initial Choices */
  // Race
  raceCategoryEverymanChoices: CharacterBuilderIdOptionalSubcategory[];
  // Culture Type
  cultureTypeCategorySkillRanks: SkillValue[];
  // Profession
  profSkillDevelopmentTypeChoices: SkillDevelopmentTypeValue[];
  profCategoryDevelopmentTypeChoices: SkillDevelopmentTypeValue[];
  profGroupDevelopmentTypeChoices: SkillDevelopmentTypeValue[];
  baseSpellListChoices: string[];
  weaponCategoryCostChoices: CharacterBuilderCategoryCost[];

  /* Initial Stats */
  initialStats: CharacterBuilderStatValue[];

  /* Hobby/Adolescent choices */
  hobbySkillRanks: SkillValue[];
  hobbyCategoryRanks: PersistentValue[];
  adolescentSpellListChoice: string | null; // SpellList.id
  adolescentLanguageChoices: LanguageAbility[];

  /* Background choices */
  backgroundStats: CharacterBuilderStatValue[];
  backgroundExtraGold: number;
  backgroundLanguageChoices: LanguageAbility[];
  backgroundSkillSpecialBonuses: SkillValue[];
  backgroundCategorySpecialBonuses: PersistentValue[];
  backgroundItems?: string[] | undefined; // Item.id[]

  /* Aggregated State */
  totalGold: number;
  languageAbilities: LanguageAbility[];
  realmProgressions: CharacterBuilderRealmProgression[];
  stats: CharacterBuilderStatValue[];

  skillRanks: SkillValue[];
  skillProfessionalBonuses: SkillValue[];
  skillSpecialBonuses: SkillValue[];
  skillDevelopmentTypes: SkillDevelopmentTypeValue[];

  categoryRanks: PersistentValue[];
  categoryProfessionalBonuses: PersistentValue[];
  categorySpecialBonuses: PersistentValue[];
  categoryCosts: CharacterBuilderCategoryCost[];

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

    magicalRealms: [],
    numHobbySkillRanks: 0,
    numAdolescentLanguageRanks: 0,
    numAdolescentSpellListRanks: 0,
    developmentPoints: 0,

    /* Initial Choices */
    // Race
    raceCategoryEverymanChoices: [],
    // Culture Type
    cultureTypeCategorySkillRanks: [],
    // Profession
    profSkillDevelopmentTypeChoices: [],
    profCategoryDevelopmentTypeChoices: [],
    profGroupDevelopmentTypeChoices: [],
    baseSpellListChoices: [],
    weaponCategoryCostChoices: [],

    /* Initial Stats */
    initialStats: [],

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
