import type { Named, PersistentValue, SkillValue } from './base';
import type { Realm, SkillDevelopmentType, Stat } from './enum';
import type { LanguageAbility } from './language';

export interface CharacterBuilderIdOptionalSubcategory {
  id: string;
  subcategory?: string | undefined;
}

export interface CharacterBuilderIdOptionalSubcategoryDevelopmentType {
  id: string;
  subcategory?: string | undefined;
  value: SkillDevelopmentType;
}

export interface CharacterBuilderIdDevelopmentType {
  id: string;
  value: SkillDevelopmentType;
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

export interface CharacterBuilder extends Named {
  built: boolean;
  num_hobby_skill_ranks: number;
  num_adolescent_spell_list_ranks: number;

  race: string;
  culture: string;
  culture_type: string;
  profession: string;
  magical_realms: Realm[];

  race_category_everyman_choices: string[];
  race_adolescent_language_choices: LanguageAbility[];

  culture_type_category_skill_ranks: SkillValue[];
  base_spell_list_choices: string[];

  prof_skill_subcategory_development_type_choices: CharacterBuilderIdOptionalSubcategoryDevelopmentType[];
  prof_skill_development_type_choices: CharacterBuilderIdOptionalSubcategoryDevelopmentType[];
  prof_category_development_type_choices: CharacterBuilderIdDevelopmentType[];
  prof_group_development_type_choices: CharacterBuilderIdDevelopmentType[];

  hobby_skill_ranks: SkillValue[];
  hobby_category_ranks: PersistentValue[];
  adolescent_spell_list_choice: string | null; // SpellList.id

  background_language_choices: LanguageAbility[];
  language_abilities: LanguageAbility[];

  realm_progressions: CharacterBuilderRealmProgression[];
  stats: CharacterBuilderStatValue[];

  everyman_skills: CharacterBuilderIdOptionalSubcategory[];
  restricted_skills: CharacterBuilderIdOptionalSubcategory[];
  everyman_skill_categories: string[];
  restricted_skill_categories: string[];

  skill_ranks: SkillValue[];
  skill_professional_bonuses: SkillValue[];
  skillsub_development_types: CharacterBuilderIdOptionalSubcategoryDevelopmentType[];
  skill_development_types: CharacterBuilderIdDevelopmentType[];

  category_ranks: PersistentValue[];
  category_professional_bonuses: PersistentValue[];
  category_special_bonuses: PersistentValue[];
  category_development_types: CharacterBuilderIdDevelopmentType[];

  group_professional_bonuses: PersistentValue[];
  group_special_bonuses: PersistentValue[];
  group_development_types: CharacterBuilderIdDevelopmentType[];

  spell_list_ranks: PersistentValue[];
}

export function createEmptyCharacterBuilder(): CharacterBuilder {
  return {
    id: '',
    name: '',
    built: false,
    num_hobby_skill_ranks: 0,
    num_adolescent_spell_list_ranks: 0,

    race: '',
    culture: '',
    culture_type: '',
    profession: '',
    magical_realms: [],

    race_category_everyman_choices: [],
    race_adolescent_language_choices: [],

    culture_type_category_skill_ranks: [],
    base_spell_list_choices: [],

    prof_skill_subcategory_development_type_choices: [],
    prof_skill_development_type_choices: [],
    prof_category_development_type_choices: [],
    prof_group_development_type_choices: [],

    hobby_skill_ranks: [],
    hobby_category_ranks: [],
    adolescent_spell_list_choice: null, // SpellList.id
    background_language_choices: [],
    language_abilities: [],

    realm_progressions: [],
    stats: [],

    everyman_skills: [],
    restricted_skills: [],
    everyman_skill_categories: [],
    restricted_skill_categories: [],

    skill_ranks: [],
    skill_professional_bonuses: [],
    skillsub_development_types: [],
    skill_development_types: [],

    category_ranks: [],
    category_professional_bonuses: [],
    category_special_bonuses: [],
    category_development_types: [],

    group_professional_bonuses: [],
    group_special_bonuses: [],
    group_development_types: [],

    spell_list_ranks: [],
  };
}
