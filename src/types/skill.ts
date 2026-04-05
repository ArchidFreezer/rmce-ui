// ------------------------
// Skill
// ------------------------
import type { SkillActionType, Stat } from './enum';
import type { Named } from './base';

export interface Skill extends Named {
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

export interface SkillBase {
  id: string;
  subcategory?: string | undefined;
}

export interface SkillValue extends SkillBase {
  value: number;
}