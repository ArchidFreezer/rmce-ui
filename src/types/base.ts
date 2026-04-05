/** Base types for common structures */
export interface Persistent {
  id: string;
}

export interface Named extends Persistent {
  name: string;
}

export interface PersistentValue extends Persistent {
  value: string;
}

export interface PersistentIntValue extends Persistent {
  value: number;
}

export interface PersistentOptionalValue extends Persistent {
  value?: string | undefined;
}

export interface PersistentOptionalIntValue extends Persistent {
  value?: number | undefined;
}