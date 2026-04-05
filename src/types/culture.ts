// src/types/culture.ts
import type { Named, PersistentValue } from './base';
import type { LanguageAbility } from './language';


export interface CultureHobbySkill {
  id: string;         // Skill.id
  subcategory?: string | undefined;
}

export interface Culture extends Named {
  description?: string | undefined;

  cultureType: string;        // CultureType.id
  highCulture: boolean;

  backgroundLanguages: LanguageAbility[];

  hobbySkills: CultureHobbySkill[];
  hobbyCategories: string[];          // SkillCategory.id[]

  preferredProfessions: string[];     // Profession.id[]
  restrictedProfessions: string[];    // Profession.id[]

  trainingPackageModifiers: PersistentValue[];
}

export interface CulturesPayload {
  cultures: Culture[];
}
