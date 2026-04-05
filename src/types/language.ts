// ------------------------
// Languages
// ------------------------
export interface Language {
  id: string;
  name: string;
  /** Reference to LanguageCategory.id */
  category: string;
  /** Optional free-text (e.g., "Common") */
  baseLanguage?: string | undefined;
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