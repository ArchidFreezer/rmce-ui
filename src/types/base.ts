/** Base types for common structures */
export interface Persistent {
  id: string;
}

export interface Named extends Persistent {
  name: string;
}