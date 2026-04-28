// ------------------------
// Languages
// ------------------------

import { Named } from './base';

export interface Language extends Named {
  category: string; // LanguageCategory.id
  baseLanguage?: string | undefined; // Optional free-text (e.g., "Common")
  isSpoken: boolean;
  isWritten: boolean;
  isSomatic: boolean;
}

export interface LanguagesPayload {
  languages: Language[];
}

export interface LanguageAbility {
  language: string;               // Language.id
  spoken?: number | undefined;
  written?: number | undefined;
  somatic?: number | undefined;  // keeping backend spelling
}

export interface CharacterLanguage {
  id: string;              // Language.id
  progression: string;     // SkillProgressionType.id
  developmentType: string; // SkillDevelopmentType
  professionBonus: number;
  specialBonus: number;
  spokenRanks: number;
  spokenBonus: number;
  writtenRanks: number;
  writtenBonus: number;
  somaticRanks: number;
  somaticBonus: number;
}