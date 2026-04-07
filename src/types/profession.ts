// src/types/profession.ts

import type {
  Realm,
  Stat,
  SkillDevelopmentType,
  SpellUserType,
} from './enum';

import type { Named, PersistentValue, PersistentDevelopmentTypeValue, SkillDevelopmentTypeValue, SkillValue } from './base';

export interface ProfessionSpellListChoice {
  numChoices: number;
  options: string[]; // SpellList.id[]
}

export interface ProfessionSkillDevelopmentTypeChoiceOption {
  id: string;                    // Skill.id
  subcategory?: string | undefined;
}

export interface ProfessionSkillDevelopmentTypeChoice {
  numChoices: number;
  type: SkillDevelopmentType;
  options: ProfessionSkillDevelopmentTypeChoiceOption[];
}

export interface ProfessionCategorySkillDevelopmentTypeChoice {
  numChoices: number;
  type: SkillDevelopmentType;
  options: string[]; // SkillCategory.id[]
}

export interface ProfessionGroupSkillDevelopmentTypeChoice {
  numChoices: number;
  type: SkillDevelopmentType;
  options: string[]; // SkillGroup.id[]
}

export interface ProfessionSkillCategoryCost {
  category: string; // SkillCategory.id
  cost: string;     // 1 to 3 colon-separated positive numbers
}

export interface Profession extends Named {
  description?: string | undefined;

  book: string; // Book.id
  allowedRaces: string[]; // Race.id[]
  spellUserType: SpellUserType;
  realms: Realm[];
  stats: Stat[];

  baseSpellListChoices: ProfessionSpellListChoice[];

  skillBonuses: SkillValue[];

  skillCategoryProfessionBonuses: PersistentValue[];
  skillCategorySpecialBonuses: PersistentValue[];

  skillGroupProfessionBonuses: PersistentValue[];
  skillGroupSpecialBonuses: PersistentValue[];

  skillDevelopmentTypes: SkillDevelopmentTypeValue[];
  skillCategorySkillDevelopmentTypes: PersistentDevelopmentTypeValue[];
  skillGroupSkillDevelopmentTypes: PersistentDevelopmentTypeValue[];

  skillDevelopmentTypeChoices: ProfessionSkillDevelopmentTypeChoice[];
  skillCategorySkillDevelopmentTypeChoices: ProfessionCategorySkillDevelopmentTypeChoice[];
  skillGroupSkillDevelopmentTypeChoices: ProfessionGroupSkillDevelopmentTypeChoice[];

  skillCategoryCosts: ProfessionSkillCategoryCost[];
}

export interface ProfessionsPayload {
  professions: Profession[];
}