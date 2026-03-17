import { SpellType, Realm } from './enum';

export interface SpellList {
  id: string;
  name: string;
  book: string;
  type: SpellType;
  evil: boolean;
  summoning: boolean;
  realms: Realm[];
}

export interface SpellListsPayload {
  spelllists: SpellList[];
}