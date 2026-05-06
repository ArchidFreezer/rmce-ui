// ------------------------
// Skill Categories
// ------------------------
import type { Stat } from './enum'; // adjust the relative path if needed
import type { CharacterTraits, Named } from './base';

export interface SkillCategory extends Named {
  group: string;                 // SkillGroup.id
  useRealmStats: boolean;
  skillProgression: string;      // SkillProgressionType.id
  categoryProgression: string;   // SkillProgressionType.id
  stats: Stat[];                 // keep order & duplicates

  /** character traits */
  traits: CharacterTraits;
}

export interface SkillCategoriesPayload {
  skillcategories: SkillCategory[];
}