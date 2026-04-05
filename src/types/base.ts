/** Base types for common structures */
import type { MaladySeverity, SkillDevelopmentType } from './enum';

export interface Persistent {
  id: string;
}

export interface Named extends Persistent {
  name: string;
}

export interface PersistentValue extends Persistent {
  value: number;
}

export interface PersistentDevelopmentTypeValue extends Persistent {
  value: SkillDevelopmentType;
}

export interface SkillValue extends PersistentValue {
  subcategory?: string | undefined;
}

export interface SkillDevelopmentTypeValue extends PersistentDevelopmentTypeValue {
  subcategory?: string | undefined;
}

export interface MaladySymptom {
  severity: MaladySeverity;
  symptoms: string;
}