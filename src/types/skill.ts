// ------------------------
// Skill
// ------------------------
import type { SkillCategory } from './skillcategory'; // reference only (id strings stored)
import type { Book } from './book';                    // reference only (id strings stored)
import type { SkillActionType, Stat } from './enum';

export interface Skill {
  id: string;
  name: string;

  /** references SkillCategory.id */
  category: string;

  /** references Book.id */
  book: string;

  /** enum SkillActionType */
  action: SkillActionType;

  /** free text / HTML allowed */
  description?: string | undefined;
  difficultiesSummary?: string | undefined;
  notes?: string | undefined;

  /** flags */
  isRestricted: boolean;
  canSpecialise: boolean;
  mandatorySubcategory: boolean;

  /** string tags (free text) */
  subcategories: string[];

  /** exactly three Stats; order preserved; duplicates allowed */
  stats: Stat[];

  /** floats */
  exhaustion: number;
  distanceMultiplier: number;
}

export interface SkillsPayload {
  skills: Skill[];
}