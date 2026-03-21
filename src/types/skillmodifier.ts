export interface SkillRankValue {
  /** references Skill.id */
  id: string;
  /** optional subcategory (free text) for certain skills */
  subcategory?: string | undefined;
  /** integer ranks */
  value: number;
}

export interface CategoryRankValue {
  /** references SkillCategory.id */
  id: string;
  /** integer ranks */
  value: number;
}