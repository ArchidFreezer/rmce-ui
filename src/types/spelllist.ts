import { SpellType, Realm } from './enum';
import type { Named } from './base';

export interface SpellList extends Named {
  book: string;
  type: SpellType;
  evil: boolean;
  summoning: boolean;
  realms: Realm[];
}

export interface SpellListsPayload {
  spelllists: SpellList[];
}