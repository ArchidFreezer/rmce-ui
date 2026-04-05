// ------------------------
// Skill Categories
// ------------------------
import type { Stat } from './enum'; // adjust the relative path if needed
import { Named } from './base';

export interface SkillCategory extends Named {
  group: string;                 // SkillGroup.id
  useRealmStats: boolean;
  skillProgression: string;      // SkillProgressionType.id
  categoryProgression: string;   // SkillProgressionType.id
  stats: Stat[];                 // keep order & duplicates
}

export interface SkillCategoriesPayload {
  skillcategories: SkillCategory[];
}