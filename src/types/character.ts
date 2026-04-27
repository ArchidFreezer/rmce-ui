import type { Named, PersistentValue, SkillValue, SkillDevelopmentTypeValue, Persistent } from './base';
import type { Realm, ResistanceType, Stat, SkillDevelopmentType } from './enum';
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
  totalBonus: number;
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
  pc: boolean;
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
    pc: false,
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

/* ------------------------------------------------------------------ */
/* Character (built / in-play)                                        */
/* ------------------------------------------------------------------ */

export interface CharacterResistance {
  id: ResistanceType;
  value: number;
}

export interface CharacterCategory {
  id: string;            // SkillCategory.id
  progression: string;   // SkillProgressionType.id
  developmentCost: string;
  professionBonus: number;
  ranks: number;
  specialBonus: number;
  totalBonus: number;
}

export interface CharacterSkill {
  skillData: SkillSubcategory; // skill id + optional subcategory
  progression: string;          // SkillProgressionType.id
  developmentType: SkillDevelopmentType;
  professionBonus: number;
  ranks: number;
  specialBonus: number;
  totalBonus: number;
}

export interface Character extends Named {
  male: boolean;
  level: number;
  experiencePoints: number;
  playerCharacter: boolean;
  gold: number;
  items?: string[] | undefined;

  race: string;       // Race.id
  culture: string;    // Culture.id
  profession: string; // Profession.id

  stats: CharacterStatValue[];
  height: number;
  weight: number;
  buildDescription: string;
  lifespan: number;

  developmentPoints: number;
  magicalRealms: Realm[];
  resistances: CharacterResistance[];
  spellListCategories: CharacterCategorySpellLists[];

  maxHits: number;
  hits: number;
  maxPowerPoints: number;
  powerPoints: number;

  languageAbilities: LanguageAbility[];
  categories: CharacterCategory[];
  skills: CharacterSkill[];
  spellListRanks?: PersistentValue[] | undefined;
}

export interface CharactersPayload {
  characters: Character[];
}

export interface CharacterLeveller extends Persistent {
  character: string;                       // Character.id being levelled
  trainingPackageCosts: PersistentValue[]; // TrainingPackage.id and cost
  trainingPackages: string[];              // TrainingPackage.id[]
  statGains: Stat[];
  skillRanks: SkillValue[];                // value = total ranks after the level up
  categoryRanks: PersistentValue[];        // value = total ranks after the level up
  spellListRanks: PersistentValue[];       // value = total ranks after the level up
  languageAbilities: LanguageAbility[];
  developmentPoints: number;               // unused DPs to carry over to the next level
}
