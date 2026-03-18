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
  isSomantic: boolean;
}

export interface LanguagesPayload {
  languages: Language[];
}