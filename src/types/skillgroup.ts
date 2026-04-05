// ------------------------
// Skill Groups
// ------------------------
import type { Named } from './base';

export interface SkillGroup extends Named { }

export interface SkillGroupsPayload {
  skillgroups: SkillGroup[];
}