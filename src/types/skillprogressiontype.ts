// ------------------------
// Skill Progression Types
// ------------------------
import type { Named } from './base';
export interface SkillProgressionType extends Named {
  /** Development point costs at ranks: 0–9, 10–19, 20–29, 30–39, and remaining (40+) */
  zero: number;
  ten: number;
  twenty: number;
  thirty: number;
  remaining: number;
}

export interface SkillProgressionTypesPayload {
  skillprogressiontypes: SkillProgressionType[];
}