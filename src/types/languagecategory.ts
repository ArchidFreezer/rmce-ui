// ------------------------
// Language Categories
// ------------------------
export interface LanguageCategory {
  id: string;
  name: string;
}

export interface LanguageCategoriesPayload {
  languagecategories: LanguageCategory[];
}