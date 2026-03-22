// src/types/profession.ts

import type {
  Realm,
  Stat,
  SkillDevelopmentType,
  SpellUserType,
} from './enum';

export interface ProfessionSpellListChoice {
  numChoices: number;
  options: string[]; // SpellList.id[]
}

export interface ProfessionSkillBonus {
  id: string;                    // Skill.id
  subcategory?: string | undefined;
  value: number;
}

export interface ProfessionCategoryBonus {
  id: string;                    // SkillCategory.id
  value: number;
}

export interface ProfessionGroupBonus {
  id: string;                    // SkillGroup.id
  value: number;
}

export interface ProfessionSkillDevelopmentType {
  id: string;                    // Skill.id
  subcategory?: string | undefined;
  value: SkillDevelopmentType;
}

export interface ProfessionCategorySkillDevelopmentType {
  id: string;                    // SkillCategory.id
  value: SkillDevelopmentType;
}

export interface ProfessionGroupSkillDevelopmentType {
  id: string;                    // SkillGroup.id
  value: SkillDevelopmentType;
}

export interface ProfessionSkillSubcategoryDevelopmentTypeChoice {
  numChoices: number;
  type: SkillDevelopmentType;
  options: string[]; // Skill.id[]
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

export interface Profession {
  id: string;
  name: string;
  description?: string | undefined;

  book: string; // Book.id
  spellUserType: SpellUserType;
  realms: Realm[];
  stats: Stat[];

  baseSpellListChoices: ProfessionSpellListChoice[];

  skillBonuses: ProfessionSkillBonus[];

  skillCategoryProfessionBonuses: ProfessionCategoryBonus[];
  skillCategorySpecialBonuses: ProfessionCategoryBonus[];

  skillGroupProfessionBonuses: ProfessionGroupBonus[];
  skillGroupSpecialBonuses: ProfessionGroupBonus[];

  skillDevelopmentTypes: ProfessionSkillDevelopmentType[];
  skillCategorySkillDevelopmentTypes: ProfessionCategorySkillDevelopmentType[];
  skillGroupSkillDevelopmentTypes: ProfessionGroupSkillDevelopmentType[];

  skillSubcategoryDevelopmentTypeChoices: ProfessionSkillSubcategoryDevelopmentTypeChoice[];
  skillDevelopmentTypeChoices: ProfessionSkillDevelopmentTypeChoice[];
  skillCategorySkillDevelopmentTypeChoices: ProfessionCategorySkillDevelopmentTypeChoice[];
  skillGroupSkillDevelopmentTypeChoices: ProfessionGroupSkillDevelopmentTypeChoice[];

  skillCategoryCosts: ProfessionSkillCategoryCost[];
}

export interface ProfessionsPayload {
  professions: Profession[];
}