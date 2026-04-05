/** Base types for common structures */
export interface Persistent {
  id: string;
}

export interface Named extends Persistent {
  name: string;
}

export interface PersistentValue extends Persistent {
  value: number;
}

export interface SkillValue extends PersistentValue {
  subcategory?: string | undefined;
}