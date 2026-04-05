// ------------------------
// Language Categories
// ------------------------

import { Named } from './base';
export interface LanguageCategory extends Named { }

export interface LanguageCategoriesPayload {
  languagecategories: LanguageCategory[];
}