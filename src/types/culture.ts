// src/types/culture.ts

export interface CultureBackgroundLanguage {
  language: string;   // Language.id
  spoken?: number | undefined;
  written?: number | undefined;
  somatic?: number | undefined;
}

export interface CultureTrainingPackageModifier {
  id: string;         // TrainingPackage.id
  value: number;
}

export interface CultureHobbySkill {
  id: string;         // Skill.id
  subcategory?: string | undefined;
}

export interface Culture {
  id: string;
  name: string;
  description?: string | undefined;

  cultureType: string;        // CultureType.id
  highCulture: boolean;

  backgroundLanguages: CultureBackgroundLanguage[];

  hobbySkills: CultureHobbySkill[];
  hobbyCategories: string[];          // SkillCategory.id[]

  preferredProfessions: string[];     // Profession.id[]
  restrictedProfessions: string[];    // Profession.id[]

  trainingPackageModifiers: CultureTrainingPackageModifier[];
}

export interface CulturesPayload {
  cultures: Culture[];
}
