// ------------------------
// Skill Categories
// ------------------------
import type { Stat } from './enum'; // adjust the relative path if needed

export interface SkillCategory {
  id: string;
  group: string;                 // SkillGroup.id
  name: string;
  useRealmStats: boolean;
  skillProgression: string;      // SkillProgressionType.id
  categoryProgression: string;   // SkillProgressionType.id
  stats: Stat[];                 // keep order & duplicates
}

export interface SkillCategoriesPayload {
  skillcategories: SkillCategory[];
}