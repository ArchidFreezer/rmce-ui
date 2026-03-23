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

export interface LanguageRank {
  language: string;               // Language.id
  spoken: number;
  written: number;
  somatic?: number | undefined;  // keeping backend spelling
}