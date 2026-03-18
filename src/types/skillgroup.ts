// ------------------------
// Skill Groups
// ------------------------
export interface SkillGroup {
  id: string;
  name: string;
}

export interface SkillGroupsPayload {
  skillgroups: SkillGroup[];
}